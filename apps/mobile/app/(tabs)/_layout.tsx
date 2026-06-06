import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#f7f7f8' },
        tabBarActiveTintColor: '#111',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
          tabBarLabel: 'Chats',
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: 'Models',
          tabBarLabel: 'Models',
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          title: 'Skills',
          tabBarLabel: 'Skills',
        }}
      />
      <Tabs.Screen
        name="connected"
        options={{
          title: 'Connected',
          tabBarLabel: 'Connected',
        }}
      />
      <Tabs.Screen
        name="benchmark"
        options={{
          title: 'Benchmark',
          tabBarLabel: 'Benchmark',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
        }}
      />
      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null,
          title: 'Chat',
        }}
      />
    </Tabs>
  );
}
