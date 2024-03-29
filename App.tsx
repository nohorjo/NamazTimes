import * as Notifications from "expo-notifications";
import { AndroidNotificationPriority } from "expo-notifications";

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Button,
  Text,
  ToastAndroid,
  Dimensions,
  TouchableOpacity,
  Picker,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { Subscription } from "@unimodules/core";

import { capitalise, HourMinuteStrings, ONE_DAY, toDate, toHMS } from "./utils";

const WIDTH = Dimensions.get("window").width;
const STORAGE_KEY_PREFIX = "@namaztimes:";
const TIMES_STORAGE_KEY = STORAGE_KEY_PREFIX + "todaytomorrow";
const MASJID_STORAGE_KEY = STORAGE_KEY_PREFIX + "masjid";

type NamazTimes = { [key: string]: HourMinuteStrings };
type Masjids = { [key: string]: { url: string; script: string }};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    priority: AndroidNotificationPriority.MAX,
  }),
});

export default function App() {
  const [now, setNow] = useState(new Date());
  const [todays, setTodays] = useState<NamazTimes>();
  const [tomorrows, setTomorrows] = useState<NamazTimes>();
  const [loaded, setLoaded] = useState(false);
  const [notificationsSet, setNotificationsSet] = useState(false);
  const [showWebView, setShowWebView] = useState(true);
  const [masjid, setMasjid] = useState<string>("northend");
  const [masjids, setMasjids] = useState<Masjids>({});

  const nextNamaz =
    todays &&
    tomorrows &&
    (Object.entries(todays)
      .map(([n, t]) => [n, toDate(t)] as [string, Date])
      .filter(([_, t]) => t > now)[0] || [
      "fajr",
      toDate(tomorrows.fajr, new Date(Date.now() + ONE_DAY)),
    ]);

  const responseListener = useRef<Subscription>();

  useEffect(() => {
    reset();

    setTodaysAndTomorrowsNotifications(todays, tomorrows, setNotificationsSet);

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(() => {
        setTodaysAndTomorrowsNotifications(
          todays,
          tomorrows,
          setNotificationsSet
        );
      });

    const timer = setInterval(() => setNow(new Date()), 1000);

    function reset() {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      clearInterval(timer);
    }

    return reset;
  }, [todays, tomorrows]);

  useEffect(() => {
    fetch("http://data.muhammedhaque.co.uk/namaztimes", { headers: { Accept: "*/*", } })
      .then(r => r.json())
      .then(data => setMasjids(data));

    AsyncStorage.getItem(TIMES_STORAGE_KEY).then((data) => {
      if (data) {
        const { todays, tomorrows } = JSON.parse(data);
        setTodays(todays);
        setTomorrows(tomorrows);
      }
    });
    AsyncStorage.getItem(MASJID_STORAGE_KEY).then((data) =>
      data && setMasjid(data)
    );

    Notifications.getAllScheduledNotificationsAsync().then((n) =>
      setNotificationsSet(!!n.length)
    );
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(MASJID_STORAGE_KEY, masjid);
  }, [masjid]);

  const { url, script } = masjids[masjid] || {};

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 5,
      }}
    >
      <TouchableOpacity
        onPress={() => {
          setShowWebView(false);
          setLoaded(false);
          setTimeout(setShowWebView, 300, true);
        }}
      >
        {nextNamaz && (
          <Text style={{ fontSize: 30, color: "#505d3e" }}>
            {capitalise(nextNamaz[0])} in{" "}
            {toHMS(nextNamaz[1].getTime() - now.getTime())}
          </Text>
        )}
      </TouchableOpacity>
      {loaded ||
        (todays &&
          Object.entries(todays).map(([name, hm], i) => (
            <Text key={`text${i}`}>
              {capitalise(name)}: {hm[0]}:{hm[1]}
            </Text>
          )))}
      {showWebView && url && (
        <WebView
          source={{ uri: url }}
          style={{ width: loaded ? WIDTH : 0 }}
          injectedJavaScript={script}
          onMessage={(e) => {
            const { todays, tomorrows } = JSON.parse(e.nativeEvent.data);
            setTimeout(() => {
              setTodays(todays);
              setTomorrows(tomorrows);
              setLoaded(true);
            }, 250);
            AsyncStorage.setItem(TIMES_STORAGE_KEY, e.nativeEvent.data);
          }}
          onLoadStart={() => setLoaded(false)}
        />
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-evenly",
        }}
      >
        <Picker
          selectedValue={masjid}
          style={{ width: 140 }}
          onValueChange={(itemValue) => setMasjid(itemValue)}
        >
          {Object.keys(masjids).map((m) => (
            <Picker.Item label={m} value={m} />
          ))}
        </Picker>
        <Button
          title={
            notificationsSet ? "Cancel notifications" : "Schedule notifications"
          }
          onPress={async () => {
            if (notificationsSet) {
              await Notifications.cancelAllScheduledNotificationsAsync();
              setNotificationsSet(false);
            } else {
              await setTodaysAndTomorrowsNotifications(
                todays,
                tomorrows,
                setNotificationsSet
              );
            }
          }}
          color={notificationsSet ? "#5d4b3e" : "#505d3e"}
        />
      </View>
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
    todays &&
    tomorrows &&
    now - setTodaysAndTomorrowsNotificationsLastRun > 200
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
    await processFilteredEntries(tomorrows, ([name, hm]) =>
      schedulePushNotification(name, toDate(hm, new Date(Date.now() + ONE_DAY)))
    );
    ToastAndroid.show("Notifications set", ToastAndroid.SHORT);
    setNotificationSet(true);
  }

  function processFilteredEntries(
    entries: NamazTimes,
    callback: (arg: [string, HourMinuteStrings]) => Promise<void>
  ) {
    return Promise.all(
      Object.entries(entries)
        .filter(([n]) => !n.includes("jamat"))
        .map(callback)
    );
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
