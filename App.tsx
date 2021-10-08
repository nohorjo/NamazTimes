import * as Notifications from 'expo-notifications';
import { AndroidNotificationPriority } from 'expo-notifications';
import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Text } from 'react-native';
import { Subscription } from '@unimodules/core';

/*
// http://portsmouthcentralmasjid.com/Prayer-Times
copy(Array.from(document.querySelectorAll('.clsMonths')).map(tr => {
    const tds = tr.querySelectorAll('td');

    return {
        fajr: hm(3),
        "fajr jamat": hm(4),
        sunrise: hm(5),
        zuhr: hm(6),
        "zuhr jamat": hm(7),
        asr: hm(9),
        "asr jamat": hm(10),
        magrib: hm(11),
        isha: hm(13),
        "isha jamat": hm(14),
    };


    function hm(n) {
        const t = tds[n].textContent;
        return [hours(t), minutes(t)];
    }
    function hours(t) {
        let h = parseInt(t);
        if (h === 12) {
            if (t.includes('AM')) {
                h = 0;
            }
        } else if (t.includes('PM')) {
            h += 12;
        }
        return h.toString();
    }
    function minutes(t) {
        let m = parseInt(t.split(':')[1]);
        if (m < 10) {
            m = "0" + m;
        }
        return m.toString();
    }
}))
*/
import times from './times.json';

const ONE_DAY = 1000 * 60 * 60 * 24;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: AndroidNotificationPriority.MAX,
  }),
});

export default function App() {
  const [now, setNow] = useState(new Date);
  const todays = times[getDayOfYear()];

  const nextNamaz = Object.entries(todays)
                      .map(([n, t]) => ([n, toDate(t)]) as [string, Date])
                      .filter(([_, t]) => t > now)[0];

  const responseListener = useRef<Subscription>();

  useEffect(() => {
    setTodaysAndTomorrowsNotifications();

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      setTodaysAndTomorrowsNotifications();
    });

    const timer = setInterval(() => setNow(new Date), 1000);

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(timer);
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {Object.entries(todays).map(([name, hm], i) => (
          <Text key={`text${i}`}>{capitalise(name)}: {hm[0]}:{hm[1]}</Text>
        ))}
      <Button
        title="Press to schedule Namaz notifications"
        onPress={async () => {
          await setTodaysAndTomorrowsNotifications();
        }}
      />
      <Text>{capitalise(nextNamaz[0])} in {toHMS(nextNamaz[1].getTime() - now.getTime())}</Text>
    </View>
  );
}

function capitalise(s: string): string {
  return s.replace(/./, c => c.toUpperCase());
}

function toHMS(millis: number): string {
  const hours = Math.floor(millis / 3600000);
  millis -= 3600000 * hours;
  const minutes = Math.floor(millis / 60000);
  millis -= 60000 * minutes;
  const seconds = Math.floor(millis / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}

async function setTodaysAndTomorrowsNotifications(): Promise<void> {
  const dayOfYear = getDayOfYear();
  const todays = times[dayOfYear];
  const tomorrows = times[dayOfYear + 1] || times[0];
  await Notifications.cancelAllScheduledNotificationsAsync();
  const today = new Date();
  await Promise.all(Object.entries(todays).filter(([n]) => !n.includes('jamat')).map(async ([name, hm]) => {
    const time = toDate(hm);
    if (today < time) {
      await schedulePushNotification(name, time);
    }
  }));
  await Promise.all(Object.entries(tomorrows).filter(([n]) => !n.includes('jamat')).map(async ([name, hm]) => {
    await schedulePushNotification(name, toDate(hm, new Date(Date.now() + ONE_DAY)));
  }));
}

async function schedulePushNotification(name: string, time: Date) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: name,
    },
    trigger: time,
  });
}

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / ONE_DAY) - 1;
}

function toDate([hours, minutes]: string[], date = new Date): Date {
  date = new Date(date);
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
}
