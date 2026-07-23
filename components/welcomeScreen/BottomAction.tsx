import { ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity, View } from "react-native";

type Props = {
    currentIndex: number;
    totalSlides: number;
    onNext: () => void;
    onSkip: () => void;
};

function BottomActions({
    currentIndex,
    totalSlides,
    onNext,
    onSkip,
}: Props) {
    const { t } = useTranslation();
    const isLast = currentIndex === totalSlides - 1;

    return (
        <View className="px-6 pb-8">
            <TouchableOpacity
                onPress={onNext}
                className="bg-blue-600 rounded-xl py-4 items-center"
            >
                <View className="flex-row gap-2">
                    <Text className="text-white text-center font-semibold text-base">
                        {isLast ? t("buttons.getStarted") : t("buttons.next")}
                    </Text>
                    <ArrowRight color="white" />
                </View>
            </TouchableOpacity>

            {!isLast && (
                <TouchableOpacity
                    onPress={onSkip}
                    className="mt-4 items-center"
                >
                    <Text className="text-gray-500 font-medium">
                        {t("buttons.skip")}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}


export default BottomActions
