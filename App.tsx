import * as Notifications from 'expo-notifications';
import { AndroidNotificationPriority } from 'expo-notifications';

import React, { useState, useEffect, useRef } from 'react';
import { View, Button, Text, ToastAndroid, Dimensions, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { Subscription } from '@unimodules/core';

import SCRIPT from './injected-script';
import { capitalise, HourMinuteStrings, ONE_DAY, toDate, toHMS } from './utils';

const WIDTH = Dimensions.get('window').width;
const STORAGE_KEY = '@namaztimes:todaytomorrow';

type NamazTimes = {[key: string]: HourMinuteStrings};

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
  const [notificationsSet, setNotificationsSet] = useState(false);

  const nextNamaz = todays && tomorrows && (
    Object.entries(todays)
      .map(([n, t]) => ([n, toDate(t)]) as [string, Date])
      .filter(([_, t]) => t > now)[0]
    || ['fajr', toDate(tomorrows.fajr, new Date(Date.now() + ONE_DAY))]
  );

  const webViewRef = useRef<WebView>(null);
  const responseListener = useRef<Subscription>();

  useEffect(() => {
    reset();

    setTodaysAndTomorrowsNotifications(todays, tomorrows, setNotificationsSet);

    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
      setTodaysAndTomorrowsNotifications(todays, tomorrows, setNotificationsSet);
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
        const { todays, tomorrows } = JSON.parse(data);
        setTodays(todays);
        setTomorrows(tomorrows);  
      }
    });

    Notifications.getAllScheduledNotificationsAsync().then(n => setNotificationsSet(!!n.length));
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
      <TouchableOpacity onPress={() => webViewRef.current?.reload()}>
        {nextNamaz && (
          <Text style={{fontSize: 30, color: '#505d3e'}}>{capitalise(nextNamaz[0])} in {toHMS(nextNamaz[1].getTime() - now.getTime())}</Text>
        )}
      </TouchableOpacity>
      {loaded || todays && Object.entries(todays).map(([name, hm], i) => (                   
        <Text key={`text${i}`}>{capitalise(name)}: {hm[0]}:{hm[1]}</Text>
      ))}                                                                
      <WebView
        ref={webViewRef}
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
        onLoadStart={() => setLoaded(false)}
      />
      <Button
        title={notificationsSet ? 'Cancel notifications' : 'Schedule Namaz notifications'}
        onPress={async () => {
          if (notificationsSet) {
            await Notifications.cancelAllScheduledNotificationsAsync();
            setNotificationsSet(false);
          } else {
            await setTodaysAndTomorrowsNotifications(todays, tomorrows, setNotificationsSet);
          }
        }}
        color={notificationsSet ? '#5d4b3e' : '#505d3e'}
      />
    </View>
  );
}

let setTodaysAndTomorrowsNotificationsLastRun = 0;
async function setTodaysAndTomorrowsNotifications(
  todays: NamazTimes | undefined,
  tomorrows: NamazTimes | undefined,
  setNotificationSet: React.Dispatch<React.SetStateAction<boolean>>
): Promise<void> {
  const now = Date.now();
  if (
    todays
    && tomorrows
    && (now - setTodaysAndTomorrowsNotificationsLastRun > 200)
  ) {
    setTodaysAndTomorrowsNotificationsLastRun = now;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const today = new Date();
    await processFilteredEntries(todays, async ([name, hm]) => {
      const time = toDate(hm);
      if (today < time) {
        await schedulePushNotification(name, time);
      }
    });
    await processFilteredEntries(tomorrows, ([name, hm]) => schedulePushNotification(name, toDate(hm, new Date(Date.now() + ONE_DAY))));
    ToastAndroid.show('Notifications set', ToastAndroid.SHORT);
    setNotificationSet(true);
  }

  function processFilteredEntries(
    entries: NamazTimes,
    callback: (arg: [string, HourMinuteStrings]) => Promise<void>
  ) {
    return Promise.all(Object.entries(entries).filter(([n]) => !n.includes('jamat')).map(callback));
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
