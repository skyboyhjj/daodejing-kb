// 道德经亲子体验营知识库 — 返回顶部按钮
// 功能：滚动超过一屏时淡入显示，点击平滑回顶
(function () {
    'use strict';

    // 动态创建按钮元素（避免手动修改每个HTML的body内容）
    var btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', '返回顶部');
    btn.setAttribute('title', '返回顶部');
    btn.setAttribute('type', 'button');
    // 简洁线条箭头 SVG
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    document.body.appendChild(btn);

    // 滚动检测阈值：一个视口高度
    var threshold = window.innerHeight || 600;
    var visible = false;
    var ticking = false;

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
            var scrollY = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollY > threshold && !visible) {
                btn.classList.add('visible');
                visible = true;
            } else if (scrollY <= threshold && visible) {
                btn.classList.remove('visible');
                visible = false;
            }
            ticking = false;
        });
    }

    // 点击回顶
    btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 键盘支持（Enter/Space）
    btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // 监听滚动
    window.addEventListener('scroll', onScroll, { passive: true });

    // 窗口尺寸变化时更新阈值
    window.addEventListener('resize', function () {
        threshold = window.innerHeight || 600;
    }, { passive: true });

    // 初始检查（页面刷新时可能已在中间位置）
    onScroll();
})();
