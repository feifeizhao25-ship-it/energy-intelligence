'use client';

import { CloudSun, Moon, Sun } from 'lucide-react';
import React from 'react';

export function PersonalizedGreeting() {
  const [greeting, setGreeting] = React.useState('');
  const [icon, setIcon] = React.useState<React.ReactNode>(null);

  // Mock User Name
  const userName = '朋友';

  React.useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) {
      setGreeting(`夜深了，${userName}，注意休息`);
      setIcon(<Moon className="w-6 h-6 text-indigo-400" />);
    } else if (hour < 9) {
      setGreeting(`早上好，${userName}`);
      setIcon(<Sun className="w-6 h-6 text-orange-400" />);
    } else if (hour < 12) {
      setGreeting(`上午好，${userName}`);
      setIcon(<CloudSun className="w-6 h-6 text-yellow-500" />);
    } else if (hour < 14) {
      setGreeting(`中午好，${userName}，记得吃饭`);
      setIcon(<Sun className="w-6 h-6 text-orange-500" />);
    } else if (hour < 18) {
      setGreeting(`下午好，${userName}`);
      setIcon(<CloudSun className="w-6 h-6 text-orange-400" />);
    } else if (hour < 22) {
      setGreeting(`晚上好，${userName}`);
      setIcon(<Moon className="w-6 h-6 text-indigo-500" />);
    } else {
      setGreeting(`夜深了，${userName}，注意休息`);
      setIcon(<Moon className="w-6 h-6 text-indigo-400" />);
    }
  }, []);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{greeting}</h1>
      </div>
      <p className="text-slate-500 font-medium">
        今天也是充满希望的一天，来看看你的电站表现吧 ⚡️
      </p>
    </div>
  );
}
