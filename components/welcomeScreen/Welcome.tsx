import Header from "@/components/ui/Header";
import { Text } from "@react-navigation/elements";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomActions from "./BottomAction";
import { slides } from "./data";
import DotIndicator from "./DotIndicator";




export default function Welcome() {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList>(null);
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / width
    );

    setCurrentIndex(index);
  };



  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.replace("/(auth)/Login");
    }
  };

  const skipSlides = () => {
    router.replace("/(auth)/Login");
  };




  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header />
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScroll}
        // className="flex-1"
        renderItem={({ item }) => (
          <View
            style={{
              width,
              height: height - 300,
            }}
            className="items-center justify-center px-6"
          >
            <View className=" my-5 items-center justify-center mb-20">
              <Text>{<item.icon size={100} />}</Text>
            </View>

            <Text className="text-3xl font-bold text-center">
              {t(item.titleKey)}
            </Text>

            <Text className="mt-4 text-center text-gray-500">
              {t(item.descriptionKey)}
            </Text>
          </View>
        )}
      />

      <BottomActions
        currentIndex={currentIndex}
        totalSlides={slides.length}
        onNext={nextSlide}
        onSkip={skipSlides}
      />

      <DotIndicator
        currentIndex={currentIndex}
        totalSlides={slides.length}
      />
    </SafeAreaView>
  );
}
