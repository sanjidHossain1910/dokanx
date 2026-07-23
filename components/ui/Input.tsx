import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import {
    KeyboardTypeOptions,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
} from "react-native";

interface InputProps extends TextInputProps {
    title?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    secure?: boolean;
    keyboardType?: KeyboardTypeOptions;
    numericOnly?: boolean;
}

export default function Input({
    title,
    placeholder,
    value,
    onChangeText,
    error,
    leftIcon,
    rightIcon,
    keyboardType,
    numericOnly = false,
    secure = false,
    ...props
}: InputProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <View className="mb-4">
            {title && (
                <Text className="text-[#0F172A] font-semibold mb-2">
                    {title}
                </Text>
            )}

            <View
                className={`flex-row items-center rounded-xl border bg-white px-4 h-14 ${error ? "border-red-500" : "border-gray-300"
                    }`}
                style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 6,
                    elevation: 2,
                }}
            >
                {leftIcon && (
                    <View className="mr-3">
                        {leftIcon}
                    </View>
                )}

                <TextInput
                    className="flex-1 text-base text-[#0F172A]"
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={numericOnly ? "number-pad" : keyboardType}
                    secureTextEntry={secure && !showPassword}
                    {...props}
                />

                {secure ? (
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? (
                            <EyeOff size={22} color="#64748B" />
                        ) : (
                            <Eye size={22} color="#64748B" />
                        )}
                    </TouchableOpacity>
                ) : (
                    rightIcon
                )}
            </View>

            {error && (
                <Text className="text-red-500 text-xs mt-2">
                    {error}
                </Text>
            )}
        </View>
    );
}