import React, { useState } from 'react';
import { Image, View } from 'react-native';
import LanguageDropdown from '../ui/LanguageDropdown';

const Header = () => {

    const [showLanguage, setShowLanguage] = useState(false);
    const [language, setLanguage] = useState("English");



    return (
        <View className="flex-row justify-between px-6 pt-2">
            <View >
                <Image
                    source={require("@/assets/logo/dokanXLogo.png")}
                    resizeMode="contain"
                    style={{
                        width: 110,
                        height: 32,
                    }}

                />
            </View>

            <LanguageDropdown />
        </View>
    )
}

export default Header