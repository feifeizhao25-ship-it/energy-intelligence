import 'package:flutter/material.dart';
import 'dart:async';

class AiAssistantScreen extends StatefulWidget {
  const AiAssistantScreen({super.key});
  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final _controller = TextEditingController();
  final _messages = <_Message>[];
  bool _isStreaming = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _sendMessage(String text) async {
    if (text.isEmpty) return;

    _messages.add(_Message(text: text, isUser: true));
    _controller.clear();
    setState(() {});

    setState(() => _isStreaming = true);
    final response = 'Based on your query about solar resource assessment at 36°N 115°W, the location shows excellent solar potential with GHI of 5.8 kWh/m²/d. I recommend installing a 100MW solar facility with estimated IRR of 14.7% and LCOE of \$0.031/kWh.';

    String displayText = '';
    for (final char in response.characters) {
      await Future.delayed(const Duration(milliseconds: 20));
      if (!mounted) return;
      displayText += char;
      _messages.add(_Message(text: displayText, isUser: false, isStreaming: true));
      setState(() {});
    }

    if (mounted) {
      _messages[_messages.length - 1] = _Message(text: displayText, isUser: false, isStreaming: false);
      setState(() => _isStreaming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Assistant'),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? Center(
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(color: const Color(0xFFF0F9FF), borderRadius: BorderRadius.circular(16)),
                            child: const Icon(Icons.auto_awesome, size: 40, color: Color(0xFF1D4ED8)),
                          ),
                          const SizedBox(height: 16),
                          const Text('Energy Intelligence AI', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
                          const SizedBox(height: 8),
                          const Text('Ask me about solar assessments, financial models, or plant health', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: Color(0xFF64748B))),
                          const SizedBox(height: 24),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Column(
                              children: [
                                _PromptChip(text: 'Solar assessment at 36°N 115°W', onTap: () => _sendMessage('Solar assessment at 36°N 115°W')),
                                const SizedBox(height: 8),
                                _PromptChip(text: 'Calculate IRR for 100MW', onTap: () => _sendMessage('Calculate IRR for 100MW')),
                                const SizedBox(height: 8),
                                _PromptChip(text: 'Diagnose gearbox fault', onTap: () => _sendMessage('Diagnose gearbox fault')),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          mainAxisAlignment: msg.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
                          children: [
                            if (!msg.isUser)
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(color: const Color(0xFFF0F9FF), borderRadius: BorderRadius.circular(8)),
                                child: const Icon(Icons.auto_awesome, size: 18, color: Color(0xFF1D4ED8)),
                              ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Container(
                                decoration: BoxDecoration(
                                  color: msg.isUser ? const Color(0xFF1D4ED8) : Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: msg.isUser ? null : Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: msg.isUser ? null : [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4)],
                                ),
                                padding: const EdgeInsets.all(12),
                                child: Text(
                                  msg.text,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: msg.isUser ? Colors.white : const Color(0xFF1E293B),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    enabled: !_isStreaming,
                    decoration: InputDecoration(
                      hintText: 'Ask about energy projects...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1D4ED8),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: IconButton(
                    onPressed: _isStreaming ? null : () => _sendMessage(_controller.text),
                    icon: const Icon(Icons.send, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Message {
  final String text;
  final bool isUser;
  final bool isStreaming;

  _Message({required this.text, required this.isUser, this.isStreaming = false});
}

class _PromptChip extends StatelessWidget {
  final String text;
  final VoidCallback onTap;

  const _PromptChip({required this.text, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Text(text, style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B))),
      ),
    );
  }
}
