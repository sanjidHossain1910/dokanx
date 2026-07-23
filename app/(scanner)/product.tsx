import { useLocalSearchParams } from "expo-router";
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const product = () => {

    const { barcode } = useLocalSearchParams<{
        barcode: string;
    }>();

    return (
        <SafeAreaView>
            <View>
                <Text>{barcode}</Text>
            </View>
        </SafeAreaView>
    )
}

export default product