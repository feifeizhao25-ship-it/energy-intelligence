'use client';

import { AlertTriangle, Shield, CheckCircle } from 'lucide-react';

const pitfalls = [
  {
    category: '报价陷阱',
    icon: '💰',
    items: [
      {
        name: '低价诱惑',
        description: '报价远低于市场价，安装时偷换劣质组件',
        howToAvoid: '对比3家以上报价，低于市场价20%要警惕',
        redFlags: ['报价比市场价低30%以上', '不让看组件品牌', '只收现金'],
      },
      {
        name: '增项收费',
        description: '安装时以各种理由增加费用',
        howToAvoid: '签合同前确认总价包含所有费用，明确增项条款',
        redFlags: ['合同没有明确总价', '大量&quot;另议&quot;条款', '口头承诺不写入合同'],
      },
      {
        name: '虚报容量',
        description: '合同写10kW，实际只装8kW',
        howToAvoid: '安装后核对组件数量和铭牌参数',
        redFlags: ['不提供组件清单', '不让现场监督', '催促快速签收'],
      },
    ],
  },
  {
    category: '合同陷阱',
    icon: '📄',
    items: [
      {
        name: '租赁伪装',
        description: '以&quot;免费安装&quot;为名，实际是租用你的屋顶',
        howToAvoid: '看清合同是&quot;购买&quot;还是&quot;租赁&quot;，收益归谁',
        redFlags: ['免费安装', '收益分成', '合同期限20-25年'],
      },
      {
        name: '贷款绑定',
        description: '被办理了不知情的贷款，要还高额利息',
        howToAvoid: '确认是否有贷款，利率是否合理',
        redFlags: ['只需签字就行', '不用出钱', '月月有收益'],
      },
      {
        name: '售后缺失',
        description: '合同没有售后条款，出问题找不到人',
        howToAvoid: '合同必须明确质保期限、响应时间、维修责任',
        redFlags: ['售后条款模糊', '公司资质不全', '无固定办公地点'],
      },
    ],
  },
  {
    category: '设备陷阱',
    icon: '🔧',
    items: [
      {
        name: '翻新组件',
        description: '使用二手或翻新组件冒充新品',
        howToAvoid: '要求提供出厂证明，核对组件序列号',
        redFlags: ['价格特别低', '组件表面有划痕', '无法提供质保卡'],
      },
      {
        name: '山寨品牌',
        description: '使用与知名品牌名字相似的山寨货',
        howToAvoid: '认准Tier1品牌，官网核实品牌真伪',
        redFlags: ['品牌名称相似但不同', '无法在官网查到', '价格远低于正品'],
      },
      {
        name: '小品牌风险',
        description: '小品牌可能几年后倒闭，质保成空',
        howToAvoid: '选择经营稳定的大品牌，查看企业资质',
        redFlags: ['公司成立不满3年', '注册资本很低', '无实际生产能力'],
      },
    ],
  },
];

export default function PitfallsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ⚠️ 光伏安装避坑指南
          </h1>
          <p className="text-gray-600">
            了解常见陷阱，保护自己的权益
          </p>
        </div>

        {/* 警示横幅 */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-semibold text-red-800">
                免费安装&quot;和&quot;零首付
              </p>
              <p className="text-sm text-red-600">
                天下没有免费的午餐，这些往往是租赁模式或高息贷款的伪装
              </p>
            </div>
          </div>
        </div>

        {/* 陷阱分类 */}
        <div className="space-y-8">
          {pitfalls.map((category) => (
            <div key={category.category} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>{category.icon}</span>
                {category.category}
              </h2>
              <div className="space-y-6">
                {category.items.map((item) => (
                  <div key={item.name} className="border-l-4 border-yellow-400 pl-4">
                    <h3 className="font-medium text-gray-900 mb-1">{item.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{item.description}</p>

                    <div className="bg-green-50 rounded-lg p-3 mb-2">
                      <p className="text-sm text-green-700">
                        <strong>如何避免：</strong>{item.howToAvoid}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.redFlags.map((flag) => (
                        <span
                          key={flag}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                        >
                          🚩 {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 自检清单 */}
        <div className="mt-8 bg-indigo-50 rounded-xl p-6 border border-indigo-100">
          <h2 className="font-semibold text-indigo-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            签合同前的自检清单
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              '确认合同是&quot;购买&quot;而非&quot;租赁&quot;',
              '总价已包含所有费用，无隐藏收费',
              '组件品牌和型号已写入合同',
              '质保期限和范围已明确',
              '售后响应时间已约定',
              '违约责任条款清晰',
              '已核实安装商资质',
              '已对比至少3家报价',
            ].map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                {item}
              </label>
            ))}
          </div>
          <div className="mt-6">
            <button className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-200">
              下载完整检查清单 PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
