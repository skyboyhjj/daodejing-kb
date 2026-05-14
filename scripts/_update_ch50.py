# -*- coding: utf-8 -*-
"""Write optimized chapter 50 metadata to family_metadata.json."""
import json
import os
from datetime import datetime

file_path = os.path.join(os.path.dirname(
    __file__), '..', 'data', 'family_metadata.json')
with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

ch50 = data['chapters']['50']

# Optimized core_idea
ch50['core_idea'] = (
    '就像小蜗牛背着小小的家慢慢走，不需要去危险的地方抢东西，也不贪心地想要更多'
    '——心里不贪不怕，身上就没有可以被伤害的缝隙。反倒是那些太拼命想'
    '\u2018活得好\u2019的人，把自己推到了危险里。安安静静的，反而最安全。'
)

# Optimized safety_notes (6 items)
ch50['safety_notes'] = [
    '避免讨论死亡比例、寿命长短等数字，以免引发孩子对死亡的恐惧。',
    '避免将小蜗牛的\u2018壳\u2019解释为\u2018躲起来才安全\u2019——应强调蜗牛背着家、自足从容，所以不需要去危险的地方。',
    '避免将\u2018无死地\u2019解释为神奇保护力或刀枪不入——应解释为：不贪不执的人，身上没有可以被危险钻入的缝隙。',
    '避免将\u2018不贪心、不害怕\u2019曲解为\u2018不能有正常的愿望或害怕的情绪\u2019，以免孩子感到自己的感受是\u2018不对的\u2019而压抑自己。',
    '避免用\u2018不去危险的地方\u2019让孩子把探索世界等同于危险——本章讲的是因贪欲而冒不必要的险，不是否定合理的探索与尝试。',
    '避免让孩子感到\u2018害怕了就是我不好\u2019——害怕是正常的保护情绪，本章讲的是不过度执着于得失，不是否定恐惧本身。',
]

# Optimized interaction_points
ch50['interaction_points'] = [
    {
        'topic': '小蜗牛的自足智慧',
        'age_4_6': '和孩子一起观察蜗牛：你看它走到哪里都背着家，慢悠悠的，不去抢也不去争。问孩子：小蜗牛为什么不需要跑得很快？因为它知足呀。',
        'age_7_9': '问孩子：小蜗牛背着家，不需要去别的地方找东西。这和老子说的\u2018不需要去危险的地方\u2019有什么关系？你有没有见过因为太想要什么东西而差点出事的例子？',
        'age_10_12': '引导讨论：老子说有一种人\u2018本来可以好好活，却因为太贪图享受把自己推到危险里\u2019。想想你身边有没有这样的人和事？这和\u2018拼命想考第一反而考砸了\u2019有什么相似？',
    },
    {
        'topic': '为什么太贪心反而不好？',
        'age_4_6': '讲一个小故事：小兔子为了多吃一根胡萝卜跑进了猎人的陷阱。问：小兔子为什么掉进陷阱？因为它太想要那根胡萝卜啦！',
        'age_7_9': '问孩子：老子说\u2018太拼命想活得好的人，反而把自己推到了危险里。\u2019为什么越拼命越危险？你能想到一个生活中的例子吗？（比如：为了多玩一会儿偷偷熬夜，第二天反而很困）',
        'age_10_12': '引入\u2018生生之厚\u2019概念：老子认为，过度追求享受（吃太好、拥有太多）反而缩短寿命。这个道理在今天的\u2018996猝死\u2019现象中还适用吗？',
    },
    {
        'topic': '把智慧带入生活',
        'age_4_6': '吃饭时，告诉孩子：慢慢吃、不贪多，小蜗牛也是这样——知足的孩子最安全。',
        'age_7_9': '和孩子聊聊：今天有没有因为太着急或太想要某样东西，差点出小问题？下次可以怎么做？',
        'age_10_12': '提醒孩子：老子的\u2018无死地\u2019不是说有神奇保护，而是身上没有可以被伤害的缝隙。下次看到别人炫富或冒险时，想想\u2018无死地\u2019的道理——不暴露弱点，就没有可以被攻击的地方。',
    },
]

# Optimized parent_tips
ch50['parent_tips'] = (
    '共读后，不妨在散步时和孩子一起找蜗牛。观察它：背着家，慢慢走，不去危险的地方'
    '——因为它不需要。这就是老子说的\u2018善摄生者\u2019。生活中，当我们因为不贪心、'
    '不着急而把事情做得更好时，别忘了轻轻提醒：\u2018你看，安安静静的，反而最安全。\u2019'
)

# Update review status
ch50['review_status'] = 'pending'
ch50['reviewed_by'] = '何继杰'
ch50['reviewed_at'] = datetime.now().strftime('%Y-%m-%d')

# Append history entry
ch50['review_history'].append({
    'action': 'revision_submitted',
    'by': '何继杰',
    'at': datetime.now().isoformat() + 'Z',
    'notes': 'Qoder基于7维度审核报告优化：刺猬→蜗牛，新增生生之厚悖论，扩展安全注意事项至6条，优化互动点与家长提示。'
})

data['_updated'] = datetime.now().strftime('%Y-%m-%d')

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
    f.write('\n')

print('OK - Chapter 50 metadata written successfully')
print('  review_status: pending')
print('  core_idea: optimized (snail metaphor + 生生之厚 paradox)')
print('  safety_notes: 6 items (3 kept + 3 new)')
print('  interaction_points: 3 topics (optimized)')
print('  parent_tips: optimized')
