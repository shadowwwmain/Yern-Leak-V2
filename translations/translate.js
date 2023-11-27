"use strict";

const languageMap = {
	"en-US": require("./en-US.json"),
	"es-ES": require("./es-ES.json"),
	"lit-lt": require("./lit-lt.json"),
	"pl-PL": require("./pl-PL.json"),
	"de-DE": require("./de-DE.json")
};

// manage aliases
for(const locale in languageMap) {
	const { aliases } = languageMap[locale];

	if(!aliases) continue;

	for(const alias of aliases) {
		languageMap[alias] = locale;
	}
}

function translateKey(locale = "en-US", key, data) {
	let keyData = typeof languageMap[locale] === "string" ? languageMap[languageMap[locale]] : languageMap[locale];
	if(!keyData) keyData = languageMap["en-US"];

	let translatedString = keyData.translations[key];

	if(!translatedString) throw Error(`Error with translation key\nLocale: ${locale}\nKey: ${key}`);

	for(const a in data) {
		translatedString = translatedString.replaceAll(`{${a}}`, data[a]);
	}

	return translatedString;
}

module.exports = {
	translateKey: translateKey,
	languageMap: languageMap
};
