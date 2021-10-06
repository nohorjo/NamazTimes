import * as Notifications from 'expo-notifications';
import { AndroidNotificationPriority } from 'expo-notifications';
import React from 'react';
import { View, Button, Text } from 'react-native';

/*
// http://portsmouthcentralmasjid.com/Prayer-Times
copy(Array.from(document.querySelectorAll('.clsMonths')).map(tr => {
    const tds = tr.querySelectorAll('td');

    return {
        fajr: hm(3),
        sunrise: hm(5),
        zuhr: hm(6),
        asr: hm(9),
        magrib: hm(11),
        isha: hm(13),
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: AndroidNotificationPriority.MAX,
  }),
});

export default function App() {
  const todays = times[dayOfYear()];
  const {
    fajr,
    sunrise,
    zuhr,
    asr,
    magrib,
    isha,
  } = todays;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {Object.entries(todays).map(([name, hm], i) => (
          <Text key={`text${i}`}>{name.replace(/./, c => c.toUpperCase())}: {hm[0]}:{hm[1]}</Text>
        ))}
      <Button
        title="Press to schedule Namaz notifications"
        onPress={async () => {
          await Notifications.cancelAllScheduledNotificationsAsync();
          const today = new Date();
          Object.entries(todays).reverse().forEach(([name, hm]) => {
            const time = toDate(hm);
            if (today < time) {
              schedulePushNotification(name, time);
            }
          });
        }}
      />
    </View>
  );
}

function schedulePushNotification(name: string, time: Date) {
  Notifications.scheduleNotificationAsync({
    content: {
      title: name,
    },
    trigger: time,
  });
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = (now.getTime() - start.getTime()) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay) - 1;
}

function toDate([hours, minutes]: string[]): Date {
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date;
}