/**
 * 慧惠 后台任务管理器 — task-manager.js
 * ==========================================
 * 非阻塞的后台任务队列系统，用于：
 *  - AI 元数据自动修订（meta_revise）
 *  - 批量元数据生成（batch_generate）
 *  - 章节审核分析（chapter_audit）
 *
 * 特性:
 *  - 内存任务队列，非阻塞异步处理
 *  - 并发控制（默认同时运行 2 个任务）
 *  - 自动重试（最多 3 次，指数退避）
 *  - 任务状态持久化到 data/tasks.json
 *  - 进度反馈（0-100%）
 *  - 定时调度支持
 */

'use strict';

var fs, path;

function _loadFS() {
    if (!fs) { fs = require('fs'); path = require('path'); }
}

// ===== 任务状态枚举 =====
var TASK_STATUS = {
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// ===== 任务类型枚举 =====
var TASK_TYPES = {
    META_REVISE: 'meta_revise',       // AI 修订单个章节
    META_GENERATE: 'meta_generate',   // AI 生成单个章节元数据
    BATCH_GENERATE: 'batch_generate', // 批量生成
    CHAPTER_AUDIT: 'chapter_audit'    // 7维度审核
};

// ===== 配置 =====
var DEFAULT_CONFIG = {
    maxConcurrent: 2,              // 最大并发任务数
    maxRetries: 3,                 // 最大重试次数
    retryBaseDelay: 2000,          // 重试基础延迟（ms）
    taskStorePath: null,           // 持久化路径（null = 不持久化）
    autoStart: true                // 创建后自动启动处理
};

var _config = Object.assign({}, DEFAULT_CONFIG);
var _tasks = new Map();            // taskId → task object
var _queue = [];                   // 排队中的 taskId 列表
var _running = new Set();          // 正在运行的 taskId 集合
var _timer = null;                 // 队列处理定时器
var _eventHandlers = {};           // 事件处理器 { 'completed': [fn, ...] }
var _taskIdCounter = 0;

// ===== 任务存储路径 =====
function _getStorePath() {
    _loadFS();
    return _config.taskStorePath || path.join(__dirname, '..', '..', 'data', 'tasks.json');
}

// ===== 内部：生成任务 ID =====
function _nextTaskId() {
    _taskIdCounter++;
    return 'task_' + Date.now().toString(36) + '_' + _taskIdCounter;
}

// ===== 内部：保存任务到磁盘 =====
function _persistTasks() {
    _loadFS();
    if (!_config.taskStorePath && !_config._persistEnabled) return;
    try {
        var storePath = _getStorePath();
        var data = {
            _updated: new Date().toISOString(),
            _config: { maxConcurrent: _config.maxConcurrent, maxRetries: _config.maxRetries },
            tasks: {}
        };
        _tasks.forEach(function (task, id) {
            data.tasks[id] = _serializeTask(task);
        });
        fs.writeFileSync(storePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    } catch (e) {
        console.error('[task-manager] 持久化失败:', e.message);
    }
}

// ===== 内部：从磁盘恢复任务 =====
function _restoreTasks() {
    _loadFS();
    try {
        var storePath = _getStorePath();
        if (!fs.existsSync(storePath)) return;
        var data = JSON.parse(fs.readFileSync(storePath, 'utf8'));

        // 恢复配置
        if (data._config) {
            if (data._config.maxConcurrent) _config.maxConcurrent = data._config.maxConcurrent;
            if (data._config.maxRetries) _config.maxRetries = data._config.maxRetries;
        }

        // 恢复任务
        var restored = 0;
        Object.keys(data.tasks || {}).forEach(function (id) {
            var t = _deserializeTask(data.tasks[id]);
            if (t.status === TASK_STATUS.QUEUED || t.status === TASK_STATUS.RUNNING) {
                // 重启时，将 running 降级为 queued（进程重启后没有在运行的任务）
                t.status = TASK_STATUS.QUEUED;
                t.startedAt = null;
            }
            _tasks.set(id, t);
            if (t.status === TASK_STATUS.QUEUED) {
                _queue.push(id);
            }
            restored++;
        });
        if (restored > 0) {
            console.log('[task-manager] 从磁盘恢复了 ' + restored + ' 个任务');
        }
    } catch (e) {
        console.error('[task-manager] 恢复任务失败:', e.message);
    }
}

// ===== 任务序列化/反序列化 =====
function _serializeTask(task) {
    var copy = {
        id: task.id,
        type: task.type,
        status: task.status,
        chapter: task.chapter,
        params: task.params,
        priority: task.priority,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        error: task.error,
        progress: task.progress,
        result: task.result,       // 保存结果（对于 completed 任务）
        triggeredBy: task.triggeredBy,
        parentTaskId: task.parentTaskId,
        subTasks: task.subTasks,
        subTasksCompleted: task.subTasksCompleted,
        subTasksTotal: task.subTasksTotal
    };
    return copy;
}

function _deserializeTask(data) {
    // 恢复 Date 对象
    if (data.createdAt && typeof data.createdAt === 'string') data.createdAt = new Date(data.createdAt);
    if (data.startedAt && typeof data.startedAt === 'string') data.startedAt = new Date(data.startedAt);
    if (data.completedAt && typeof data.completedAt === 'string') data.completedAt = new Date(data.completedAt);
    return data;
}

// ===== 事件系统 =====
function on(event, handler) {
    if (!_eventHandlers[event]) _eventHandlers[event] = [];
    _eventHandlers[event].push(handler);
}

function _emit(event, task) {
    var handlers = _eventHandlers[event] || [];
    handlers.forEach(function (fn) {
        try { fn(task); } catch (e) { /* silent */ }
    });
}

// ===== 核心：入队任务 =====
/**
 * @param {string} type   - 任务类型 (TASK_TYPES)
 * @param {number} chapter - 章节号
 * @param {object} [params] - 额外参数
 * @param {object} [opts]   - 选项 { priority, maxRetries, triggeredBy, parentTaskId }
 * @returns {string} taskId
 */
function enqueue(type, chapter, params, opts) {
    opts = opts || {};
    var id = _nextTaskId();
    var task = {
        id: id,
        type: type,
        status: TASK_STATUS.QUEUED,
        chapter: chapter,
        params: params || {},
        priority: opts.priority || 0,
        retryCount: 0,
        maxRetries: opts.maxRetries !== undefined ? opts.maxRetries : _config.maxRetries,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        error: null,
        progress: 0,
        result: null,
        triggeredBy: opts.triggeredBy || 'system',
        parentTaskId: opts.parentTaskId || null,
        subTasks: [],
        subTasksCompleted: 0,
        subTasksTotal: 0
    };
    _tasks.set(id, task);

    // 按优先级插入队列
    var inserted = false;
    for (var i = 0; i < _queue.length; i++) {
        var existing = _tasks.get(_queue[i]);
        if (existing && task.priority > existing.priority) {
            _queue.splice(i, 0, id);
            inserted = true;
            break;
        }
    }
    if (!inserted) {
        _queue.push(id);
    }

    _persistTasks();
    _emit('enqueued', task);

    // 自动开始处理
    if (_config.autoStart) {
        _processQueue();
    }

    return id;
}

// ===== 核心：处理队列 =====
function _processQueue() {
    if (_timer) return; // 已经在处理

    _timer = setTimeout(_processNext, 0);
}

function _processNext() {
    _timer = null;

    // 检查是否还有容量
    while (_running.size < _config.maxConcurrent && _queue.length > 0) {
        var taskId = _queue.shift();
        var task = _tasks.get(taskId);
        if (!task) continue;
        if (task.status === TASK_STATUS.CANCELLED) continue;

        _startTask(task);
    }

    // 如果队列还有任务但还没到容量，继续检查
    if (_queue.length > 0 && _running.size < _config.maxConcurrent) {
        _timer = setTimeout(_processNext, 100);
    }
}

// ===== 启动任务 =====
function _startTask(task) {
    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date();
    task.progress = 0;
    task.error = null;
    _running.add(task.id);
    _persistTasks();
    _emit('started', task);

    _executeTask(task)
        .then(function (result) {
            _completeTask(task, result);
        })
        .catch(function (err) {
            _failTask(task, err);
        });
}

// ===== 执行任务（路由到具体处理器） =====
function _executeTask(task) {
    var handler = _taskHandlers[task.type];
    if (!handler) {
        return Promise.reject(new Error('未知任务类型: ' + task.type));
    }
    return handler(task);
}

// ===== 任务处理器注册表 =====
var _taskHandlers = {};

/**
 * 注册任务处理器
 * @param {string} type    - 任务类型
 * @param {function} handler - (task) => Promise<result>
 */
function registerHandler(type, handler) {
    _taskHandlers[type] = handler;
}

// ===== 完成任务 =====
function _completeTask(task, result) {
    task.status = TASK_STATUS.COMPLETED;
    task.completedAt = new Date();
    task.progress = 100;
    task.result = result;
    _running.delete(task.id);
    _persistTasks();
    _emit('completed', task);

    // 如果有父任务，通知父任务
    _notifyParent(task);
    // 继续处理队列
    _processQueue();
}

// ===== 任务失败 =====
function _failTask(task, err) {
    task.retryCount = (task.retryCount || 0) + 1;
    var canRetry = task.retryCount <= task.maxRetries;

    if (canRetry) {
        // 指数退避重试
        var delay = _config.retryBaseDelay * Math.pow(2, task.retryCount - 1);
        task.error = 'Retry ' + task.retryCount + '/' + task.maxRetries + ': ' + (err.message || String(err));
        task.status = TASK_STATUS.QUEUED;
        task.progress = 0;
        _running.delete(task.id);
        _queue.unshift(task.id); // 放在队首优先重试
        _persistTasks();
        _emit('retrying', task);
        console.log('[task-manager] 任务 ' + task.id + ' 将在 ' + delay + 'ms 后重试 (' + task.retryCount + '/' + task.maxRetries + ')');
        setTimeout(_processQueue, delay);
    } else {
        task.status = TASK_STATUS.FAILED;
        task.completedAt = new Date();
        task.error = err.message || String(err);
        _running.delete(task.id);
        _persistTasks();
        _emit('failed', task);
        _notifyParent(task);
        _processQueue();
    }
}

// ===== 通知父任务子任务完成/失败 =====
function _notifyParent(childTask) {
    if (!childTask.parentTaskId) return;
    var parent = _tasks.get(childTask.parentTaskId);
    if (!parent || parent.type !== TASK_TYPES.BATCH_GENERATE) return;

    parent.subTasksCompleted = (parent.subTasksCompleted || 0) + 1;
    if (childTask.status === TASK_STATUS.FAILED) {
        parent.subTasksFailed = (parent.subTasksFailed || 0) + 1;
    }

    // 更新进度
    if (parent.subTasksTotal > 0) {
        parent.progress = Math.floor((parent.subTasksCompleted / parent.subTasksTotal) * 100);
    }

    // 检查是否所有子任务完成
    if (parent.subTasksCompleted >= parent.subTasksTotal) {
        _running.delete(parent.id);
        if (parent.subTasksFailed > 0) {
            parent.status = TASK_STATUS.COMPLETED; // 部分失败也算完成
            parent.error = parent.subTasksFailed + ' 个子任务失败';
        } else {
            parent.status = TASK_STATUS.COMPLETED;
        }
        parent.completedAt = new Date();
        parent.progress = 100;
        _emit('completed', parent);
    }

    _persistTasks();
}

// ===== 取消任务 =====
function cancelTask(taskId) {
    var task = _tasks.get(taskId);
    if (!task) return false;

    if (task.status === TASK_STATUS.QUEUED) {
        // 从队列移除
        var idx = _queue.indexOf(taskId);
        if (idx !== -1) _queue.splice(idx, 1);
        task.status = TASK_STATUS.CANCELLED;
        task.completedAt = new Date();
        _persistTasks();
        return true;
    }

    if (task.status === TASK_STATUS.RUNNING) {
        // 无法取消正在运行的任务（但标记取消，处理器应检查）
        task._cancelled = true;
        return false;
    }

    return false;
}

// ===== 获取任务 =====
function getTask(taskId) {
    var task = _tasks.get(taskId);
    if (!task) return null;
    return _serializeTask(task);
}

// ===== 获取所有任务 =====
function getAllTasks(opts) {
    opts = opts || {};
    var result = [];
    _tasks.forEach(function (task) {
        if (opts.type && task.type !== opts.type) return;
        if (opts.status && task.status !== opts.status) return;
        if (opts.chapter && task.chapter !== opts.chapter) return;
        result.push(_serializeTask(task));
    });

    // 按创建时间倒序
    result.sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 分页
    var limit = opts.limit || 50;
    var offset = opts.offset || 0;
    return {
        total: result.length,
        tasks: result.slice(offset, offset + limit)
    };
}

// ===== 获取统计 =====
function getStats() {
    var stats = {
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
    };
    _tasks.forEach(function (task) {
        stats.total++;
        if (task.status === TASK_STATUS.QUEUED) stats.queued++;
        else if (task.status === TASK_STATUS.RUNNING) stats.running++;
        else if (task.status === TASK_STATUS.COMPLETED) stats.completed++;
        else if (task.status === TASK_STATUS.FAILED) stats.failed++;
        else if (task.status === TASK_STATUS.CANCELLED) stats.cancelled++;
    });
    return stats;
}

// ===== 清空已完成的旧任务 =====
function pruneTasks(olderThanDays) {
    var cutoff = Date.now() - (olderThanDays || 7) * 24 * 60 * 60 * 1000;
    var removed = 0;
    _tasks.forEach(function (task, id) {
        if (task.status === TASK_STATUS.COMPLETED ||
            task.status === TASK_STATUS.FAILED ||
            task.status === TASK_STATUS.CANCELLED) {
            if (new Date(task.completedAt || task.createdAt).getTime() < cutoff) {
                _tasks.delete(id);
                var qIdx = _queue.indexOf(id);
                if (qIdx !== -1) _queue.splice(qIdx, 1);
                removed++;
            }
        }
    });
    if (removed > 0) {
        _persistTasks();
        console.log('[task-manager] 清理了 ' + removed + ' 个旧任务');
    }
    return removed;
}

// ===== 定时调度 =====
var _scheduledJobs = {};

/**
 * 注册定时任务
 * @param {string} name        - 任务名称
 * @param {string} cronOrMs    - 毫秒间隔 或 '@daily'/'@hourly'
 * @param {function} jobFn     - 执行函数
 */
function schedule(name, intervalMs, jobFn) {
    if (_scheduledJobs[name]) {
        clearInterval(_scheduledJobs[name]);
    }
    _scheduledJobs[name] = setInterval(function () {
        try {
            jobFn();
        } catch (e) {
            console.error('[task-manager] 定时任务 ' + name + ' 出错:', e.message);
        }
    }, intervalMs);
    console.log('[task-manager] 已注册定时任务: ' + name + ' (每 ' + (intervalMs / 1000) + 's)');
}

function unschedule(name) {
    if (_scheduledJobs[name]) {
        clearInterval(_scheduledJobs[name]);
        delete _scheduledJobs[name];
    }
}

// ===== 初始化 =====
/**
 * @param {object} [config] - 配置覆盖
 */
function init(config) {
    if (config) {
        Object.assign(_config, config);
    }
    _loadFS();
    _config.taskStorePath = _getStorePath();

    // 从磁盘恢复任务
    _restoreTasks();
    // 重新启动队列处理
    if (_config.autoStart && _queue.length > 0) {
        _processQueue();
    }

    // 定期清理旧任务（每 6 小时）
    schedule('__prune', 6 * 60 * 60 * 1000, function () {
        pruneTasks(7);
    });

    console.log('[task-manager] 已初始化 (并发: ' + _config.maxConcurrent + ', 重试: ' + _config.maxRetries + '次)');
}

// ===== 启用持久化 =====
function enablePersistence(customPath) {
    _config._persistEnabled = true;
    if (customPath) _config.taskStorePath = customPath;
    _persistTasks();
}

// ===== 批量任务辅助 =====

/**
 * 为父任务添加子任务引用（批量任务的内部使用）
 */
function addSubTask(parentTaskId, subTaskId) {
    var parent = _tasks.get(parentTaskId);
    if (!parent) return false;
    if (!parent.subTasks) parent.subTasks = [];
    parent.subTasks.push(subTaskId);
    parent.subTasksTotal = parent.subTasks.length;
    _persistTasks();
    return true;
}

/**
 * 更新父任务的总子任务数（批量任务的内部使用）
 */
function setSubTasksTotal(parentTaskId, total) {
    var parent = _tasks.get(parentTaskId);
    if (!parent) return;
    parent.subTasksTotal = total;
    _persistTasks();
}

// ===== 导出 =====
module.exports = {
    TASK_STATUS: TASK_STATUS,
    TASK_TYPES: TASK_TYPES,

    init: init,
    enqueue: enqueue,
    cancelTask: cancelTask,
    getTask: getTask,
    getAllTasks: getAllTasks,
    getStats: getStats,
    registerHandler: registerHandler,
    pruneTasks: pruneTasks,
    schedule: schedule,
    unschedule: unschedule,
    enablePersistence: enablePersistence,
    addSubTask: addSubTask,
    setSubTasksTotal: setSubTasksTotal,
    on: on
};
