import React from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
}

const Checkbox = ({
    checked,
    onChange,
    label,
    disabled = false,
}: CheckboxProps) => {
    return (
        <Pressable
            disabled={disabled}
            onPress={() => onChange(!checked)}
            className="flex-row items-center"
            style={({ pressed }) => ({
                opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
            })}
        >
            <View
                className={`w-6 h-6 rounded-md border-2 items-center justify-center ${checked
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300"
                    }`}
            >
                {checked && <Check size={16} color="#fff" strokeWidth={3} />}
            </View>

            {label && (
                <Text className="ml-3 text-base text-slate-700">
                    {label}
                </Text>
            )}
        </Pressable>
    );
};

export default Checkbox;