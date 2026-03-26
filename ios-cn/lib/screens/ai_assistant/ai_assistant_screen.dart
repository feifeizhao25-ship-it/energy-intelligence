import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class Message {
  final String content;
  final bool isUser;
  final String? toolName;

  Message({required this.content, required this.isUser, this.toolName});
}

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final _messageController = TextEditingController();
  final List<Message> _messages = [];
  bool _isProcessing = false;

  final List<String> _quickPrompts = [
    '🌞 查询光伏资源潜力',
    '💰 计算项目收益',
    '⚙️ 诊断设备故障',
    '📊 生成性能报告',
  ];

  void _sendMessage(String text) async {
    if (text.isEmpty) return;

    setState(() {
      _messages.add(Message(content: text, isUser: true));
      _isProcessing = true;
      _messageController.clear();
    });

    await Future.delayed(Duration(milliseconds: 800));

    String toolName = '';
    String response = '';

    if (text.contains('光伏') || text.contains('太阳')) {
      toolName = '光伏资源评估';
      response = '正在为您查询山东地区的光伏资源数据...\n\n' +
          '📊 光伏资源评估结果：\n' +
          '• 年均GHI: 1456.8 kWh/m²\n' +
          '• 年均DNI: 1876.5 kWh/m²\n' +
          '• 资源等级: B级\n' +
          '• 建议: 该地区属于二类资源区，光照条件良好，建议采用固定式安装方案。';
    } else if (text.contains('收益') || text.contains('财务') || text.contains('计算')) {
      toolName = '财务计算';
      response = '正在为您计算项目财务指标...\n\n' +
          '💰 财务模型计算结果：\n' +
          '• 项目IRR: 12.47%\n' +
          '• NPV (25年): 45.23百万元\n' +
          '• LCOE: ¥0.2186/kWh\n' +
          '• 投资回收期: 8.2年\n' +
          '该项目具有良好的经济性。';
    } else if (text.contains('故障') || text.contains('诊断') || text.contains('运维')) {
      toolName = '健康诊断';
      response = '正在分析设备运行状态...\n\n' +
          '⚠️ 诊断结果：\n' +
          '• 综合健康评分: 82分\n' +
          '• 关键发现: 发现3处需要关注的问题\n' +
          '• 逆变器: 输出功率下降15%\n' +
          '• 建议: 立即进行PCS-12号机组故障诊断与维修，预期可恢复月度收益4375元。';
    } else {
      response = '我是新能源智库的AI助手，可以帮助您：\n\n' +
          '✅ 查询光伏/风电资源评估\n' +
          '✅ 计算项目财务指标\n' +
          '✅ 诊断电站设备状况\n' +
          '✅ 提供运维优化建议\n\n' +
          '请告诉我您需要什么帮助，比如"查询光伏资源"或"计算项目收益"。';
    }

    await Future.delayed(Duration(milliseconds: 1200));

    if (toolName.isNotEmpty) {
      setState(() {
        _messages.add(Message(content: '正在$toolName...', isUser: false, toolName: toolName));
      });
      await Future.delayed(Duration(milliseconds: 2000));
    }

    setState(() {
      _messages.removeWhere((m) => m.toolName != null);
      _messages.add(Message(content: response, isUser: false));
      _isProcessing = false;
    });

    _scrollToBottom();
  }

  void _scrollToBottom() {
    Future.delayed(Duration(milliseconds: 100), () {
      if (mounted) {
        // Scroll simulation
      }
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('AI助手')),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    padding: EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) => _buildMessage(_messages[index]),
                  ),
          ),
          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.smart_toy, size: 64, color: AppTheme.primaryColor),
          SizedBox(height: 16),
          Text(
            '新能源智库AI助手',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            '有什么我可以帮助的吗？',
            style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
          ),
          SizedBox(height: 32),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _quickPrompts
                  .map((prompt) => GestureDetector(
                        onTap: () => _sendMessage(prompt),
                        child: Container(
                          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppTheme.primaryColor),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            prompt,
                            style: TextStyle(fontSize: 12, color: AppTheme.primaryColor),
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessage(Message message) {
    if (message.toolName != null) {
      return Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            Container(
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: 8),
                  Text(
                    '正在${message.toolName}...',
                    style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: message.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!message.isUser)
            Padding(
              padding: EdgeInsets.only(right: 8),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(color: AppTheme.primaryColor, shape: BoxShape.circle),
                child: Icon(Icons.smart_toy, color: Colors.white, size: 18),
              ),
            ),
          Flexible(
            child: Container(
              padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: message.isUser ? AppTheme.primaryColor : Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                message.content,
                style: TextStyle(
                  fontSize: 13,
                  color: message.isUser ? Colors.white : Color(0xFF0F172A),
                  height: 1.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              decoration: InputDecoration(
                hintText: '输入问题或指令...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              enabled: !_isProcessing,
            ),
          ),
          SizedBox(width: 8),
          FloatingActionButton(
            mini: true,
            onPressed: _isProcessing ? null : () => _sendMessage(_messageController.text),
            child: Icon(Icons.send),
          ),
        ],
      ),
    );
  }
}
