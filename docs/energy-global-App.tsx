/**
 * Energy Intelligence Global - Expo App
 * Global Version (English)
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [screen, setScreen] = useState('home');

  const renderScreen = () => {
    switch (screen) {
      case 'home': return <HomeScreen onNavigate={setScreen} />;
      case 'projects': return <ProjectsScreen />;
      case 'calculator': return <CalculatorScreen />;
      case 'maintenance': return <MaintenanceScreen />;
      case 'assistant': return <AssistantScreen />;
      default: return <HomeScreen onNavigate={setScreen} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      <View style={styles.tabBar}>
        {['home', 'folder', 'calculator', 'build', 'chat'].map((icon, index) => (
          <TouchableOpacity key={icon} style={styles.tabItem} onPress={() => setScreen(icon)}>
            <Text style={[styles.tabIcon, screen === icon && styles.tabActive]}>{getIcon(icon)}</Text>
            <Text style={[styles.tabLabel, screen === icon && styles.tabActiveLabel]}>{getLabel(icon)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function getIcon(name: string) {
  const icons: Record<string, string> = { home: '🏠', folder: '📁', calculator: '🔢', build: '🔧', chat: '💬' };
  return icons[name] || '•';
}

function getLabel(name: string) {
  const labels: Record<string, string> = { home: 'Home', folder: 'Projects', calculator: 'Calculator', build: 'Maintenance', chat: 'AI' };
  return labels[name] || '';
}

// Home Screen
function HomeScreen({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <ScrollView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Energy Intelligence</Text>
        <Text style={styles.subtitle}>Global Platform</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome Back</Text>
        <Text style={styles.cardText}>Manage your global energy projects</Text>
      </View>
      <Text style={styles.sectionTitle}>Quick Stats</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>Projects</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>8</Text><Text style={styles.statLabel}>Plants</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>3</Text><Text style={styles.statLabel}>Alerts</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('projects')}>
        <Text style={styles.actionIcon}>📁</Text><Text style={styles.actionText}>New Project</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('calculator')}>
        <Text style={styles.actionIcon}>🔢</Text><Text style={styles.actionText}>ROI Calculator</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionItem} onPress={() => onNavigate('assistant')}>
        <Text style={styles.actionIcon}>💬</Text><Text style={styles.actionText}>AI Assistant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Projects Screen
function ProjectsScreen() {
  const projects = [
    { name: 'Solar Farm Texas', type: 'Solar', capacity: '100 MW', status: 'Operating' },
    { name: 'Wind Park California', type: 'Wind', capacity: '50 MW', status: 'Operating' },
    { name: 'Storage Station NY', type: 'Storage', capacity: '25 MWh', status: 'Planning' },
  ];
  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.headerTitle}>Projects</Text>
      {projects.map((p, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={styles.listIcon}>{p.type === 'Solar' ? '☀️' : p.type === 'Wind' ? '💨' : '🔋'}</Text>
          <View style={styles.listContent}>
            <Text style={styles.listTitle}>{p.name}</Text>
            <Text style={styles.listSubtitle}>{p.capacity} - {p.status}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// Calculator Screen
function CalculatorScreen() {
  const [capacity, setCapacity] = useState('');
  const [result, setResult] = useState('');

  const calculate = () => {
    const cap = parseFloat(capacity) || 0;
    if (cap <= 0) { setResult('Enter valid capacity'); return; }
    const capex = cap * 3.5;
    const gen = cap * 1400;
    const rev = gen * 0.12;
    const profit = rev * 0.7;
    const irr = (profit / capex) * 100;
    setResult(`Capacity: ${cap}kW\nInvestment: $${capex.toFixed(0)}\nAnnual Gen: ${gen}kWh\nIRR: ${irr.toFixed(1)}%`);
  };

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.headerTitle}>ROI Calculator</Text>
      <TextInput style={styles.input} placeholder="Capacity (kW)" keyboardType="numeric" value={capacity} onChangeText={setCapacity} />
      <TouchableOpacity style={styles.button} onPress={calculate}>
        <Text style={styles.buttonText}>Calculate</Text>
      </TouchableOpacity>
      {result ? <View style={styles.resultBox}><Text style={styles.resultText}>{result}</Text></View> : null}
    </ScrollView>
  );
}

// Maintenance Screen
function MaintenanceScreen() {
  const issues = [
    { plant: 'Solar Farm TX', issue: 'Inverter E001', status: 'Open', priority: 'High' },
    { plant: 'Wind Park CA', issue: 'Blade inspection', status: 'Scheduled', priority: 'Medium' },
  ];
  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.headerTitle}>Maintenance</Text>
      {issues.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <Text style={styles.listIcon}>{item.priority === 'High' ? '🔴' : '🟡'}</Text>
          <View style={styles.listContent}>
            <Text style={styles.listTitle}>{item.plant}</Text>
            <Text style={styles.listSubtitle}>{item.issue} - {item.status}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// Assistant Screen
function AssistantScreen() {
  const [messages, setMessages] = useState([{ text: 'Hello! How can I help with your energy projects?', from: 'bot' }]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages([...messages, { text: input, from: 'user' }]);
    setMessages([...messages, { text: input, from: 'user' }, { text: 'I can help you with that analysis.', from: 'bot' }]);
    setInput('');
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.headerTitle}>AI Assistant</Text>
      <ScrollView style={styles.chatHistory}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.chatBubble, m.from === 'user' ? styles.chatUser : styles.chatBot]}>
            <Text style={m.from === 'user' ? styles.chatTextUser : styles.chatTextBot}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.chatInput}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask about your project..." />
        <TouchableOpacity onPress={send}><Text style={styles.sendButton}>Send</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1 },
  screen: { flex: 1, padding: 16 },
  header: { padding: 16, backgroundColor: '#1976D2', borderRadius: 12, marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.8 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  cardText: { color: '#666', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', flex: 1, marginHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1976D2' },
  statLabel: { fontSize: 12, color: '#666' },
  actionItem: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  actionIcon: { fontSize: 24, marginRight: 12 },
  actionText: { fontSize: 16 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#1976D2', padding: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultBox: { backgroundColor: '#e3f2fd', padding: 16, borderRadius: 8, marginTop: 12 },
  resultText: { fontSize: 14, fontFamily: 'monospace' },
  listItem: { backgroundColor: '#fff', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  listIcon: { fontSize: 24, marginRight: 12 },
  listContent: { flex: 1 },
  listTitle: { fontSize: 16, fontWeight: 'bold' },
  listSubtitle: { fontSize: 14, color: '#666' },
  chatHistory: { flex: 1, marginBottom: 8 },
  chatBubble: { padding: 12, borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  chatUser: { backgroundColor: '#1976D2', alignSelf: 'flex-end' },
  chatBot: { backgroundColor: '#fff', alignSelf: 'flex-start' },
  chatTextUser: { color: '#fff' },
  chatTextBot: { color: '#333' },
  chatInput: { flexDirection: 'row', alignItems: 'center' },
  sendButton: { color: '#1976D2', fontWeight: 'bold', marginLeft: 8 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', paddingVertical: 8 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20 },
  tabActive: { opacity: 1 },
  tabLabel: { fontSize: 10, color: '#999' },
  tabActiveLabel: { color: '#1976D2' },
});
