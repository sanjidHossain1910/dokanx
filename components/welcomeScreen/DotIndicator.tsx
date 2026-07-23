import { View } from "react-native";

type Props = {
  currentIndex: number;
  totalSlides: number;
};

export default function DotIndicator({
  currentIndex,
  totalSlides,
}: Props) {
  return (
    <View className="flex-row justify-center items-center mt-6">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <View
          key={index}
          className={`mx-1 rounded-full ${
            currentIndex === index
              ? "w-6 h-2 bg-blue-600"
              : "w-2 h-2 bg-gray-300"
          }`}
        />
      ))}
    </View>
  );
}