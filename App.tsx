import * as Notifications from 'expo-notifications';
import { AndroidNotificationPriority } from 'expo-notifications';

import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Text, ToastAndroid, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Subscription } from '@unimodules/core';

import SCRIPT from './injected-script';

const WIDTH = Dimensions.get('window').width;
const ONE_DAY = 1000 * 60 * 60 * 24;
const STORAGE_KEY = '@namaztimes:todaytomorrow';

type NamazTimes = {[key: string]: [string, string]};

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
  const [todays, setTodays] = useState<NamazTimes>();
  const [tomorrows, setTomorrows] = useState<NamazTimes>();
  const [loaded, setLoaded] = useState(false);

  const nextNamaz = todays && tomorrows && (
    Object.entries(todays)
      .map(([n, t]) => ([n, toDate(t)]) as [string, Date])
      .filter(([_, t]) => t > now)[0]
    || ['fajr', toDate(tomorrows.fajr, new Date(Date.now() + ONE_DAY))]
  );

  const responseListener = useRef<Subscription>();

  useEffect(() => {
    reset();

    setTodaysAndTomorrowsNotifications(todays, tomorrows);

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      setTodaysAndTomorrowsNotifications(todays, tomorrows);
    });

    const timer = setInterval(() => setNow(new Date), 1000);

    function reset() {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(timer);
    }

    return reset;
  }, [todays, tomorrows]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) {
        const {todays, tomorrows} = JSON.parse(data);
        setTodays(todays);
        setTomorrows(tomorrows);  
      }
    });
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
      }
    }>
      {nextNamaz && (
        <Text style={{fontSize: 30, color: '#505d3e'}}>{capitalise(nextNamaz[0])} in {toHMS(nextNamaz[1].getTime() - now.getTime())}</Text>
      )}
      {loaded || todays && Object.entries(todays).map(([name, hm], i) => (                   
        <Text key={`text${i}`}>{capitalise(name)}: {hm[0]}:{hm[1]}</Text>
      ))}                                                                
      <WebView
        source={{uri: 'http://portsmouthcentralmasjid.com/Prayer-Times'}}
        style={{width: loaded ? WIDTH : 0}}
        injectedJavaScript={SCRIPT}
        onMessage={e => {
          const {todays, tomorrows} = JSON.parse(e.nativeEvent.data);
          setTimeout(() => {
            setTodays(todays);
            setTomorrows(tomorrows);
            setLoaded(true);
          }, 250);
          AsyncStorage.setItem(STORAGE_KEY, e.nativeEvent.data);
        }}
      />
      <Button
        title="Press to schedule Namaz notifications"
        onPress={async () => {
          await setTodaysAndTomorrowsNotifications(todays, tomorrows);
        }}
        color={'#505d3e'}
      />
    </View>
  );
}

function capitalise(s: string): string {
  return s.replace(/./, c => c.toUpperCase());
}

function toHMS(millis: number): string {
  let formatString = '';
  const hours = Math.floor(millis / 3600000);
  if (hours) {
    formatString += `${pad(hours)}h `;
  }
  millis -= 3600000 * hours;
  const minutes = Math.floor(millis / 60000);
  if (formatString || minutes) {
    formatString += `${pad(minutes)}m `;
  }
  millis -= 60000 * minutes;
  const seconds = Math.floor(millis / 1000);
  formatString += `${pad(seconds)}s `;

  return formatString;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : n.toString();
}
let setTodaysAndTomorrowsNotificationsLastRun = 0;
async function setTodaysAndTomorrowsNotifications(todays?: NamazTimes, tomorrows?: NamazTimes): Promise<void> {
  if (
    todays
    && tomorrows
    && (Date.now() - setTodaysAndTomorrowsNotificationsLastRun > 200)
  ) {
    setTodaysAndTomorrowsNotificationsLastRun = Date.now();
    const dayOfYear = getDayOfYear();
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
    ToastAndroid.show('Notifications set', ToastAndroid.SHORT);
  }
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
