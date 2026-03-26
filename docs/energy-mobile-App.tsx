import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, StyleSheet } from 'react-native';

import DashboardScreen from './src/screens/DashboardScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import CalculatorScreen from './src/screens/CalculatorScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import DiagnosisScreen from './src/screens/DiagnosisScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { currentConfig } from './src/config/region';

const tabs = [
  { key: 'dashboard', icon: '🏠', label: 'Home', screen: DashboardScreen },
  { key: 'projects', icon: '📁', label: 'Projects', screen: ProjectsScreen },
  { key: 'calculator', icon: '🧮', label: 'Calc', screen: CalculatorScreen },
  { key: 'assistant', icon: '🤖', label: 'AI', screen: AssistantScreen },
  { key: 'profile', icon: '👤', label: 'Profile', screen: ProfileScreen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  const ActiveScreen = tabs.find(t => t.key === activeTab)?.screen || DashboardScreen;

  if (showDiagnosis) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.diagnosisHeader}>
          <TouchableOpacity onPress={() => setShowDiagnosis(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.diagnosisTitle}>🔧 Diagnosis</Text>
        </View>
        <DiagnosisScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
        <ActiveScreen 
          navigation={{ 
            navigate: (screen: string) => {
              if (screen === 'Diagnosis') setShowDiagnosis(true);
              else setActiveTab(screen);
            }
          }} 
        />
      </ScrollView>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabIcon, activeTab === tab.key && styles.tabIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155', paddingVertical: 8, paddingBottom: 24 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 22, opacity: 0.6 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 10, color: '#64748B', marginTop: 2 },
  tabLabelActive: { color: '#3B82F6', fontWeight: '600' },
  diagnosisHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#3B82F6', fontSize: 16 },
  diagnosisTitle: { color: '#FFF', fontSize: 18, fontWeight: '600', marginLeft: 16 },
});
