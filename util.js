"use strict";

const { client } = require("./index.js");
const { userModel } = require("./database.js");

const logs_channel = client.config.logs_channel;

async function sendHoneyportAlert(interaction, realmCode) {
	const guild = interaction.channel.guild;
	const user = interaction.user;

	let invite;
	try {
		invite = `https://discord.gg/${(await guild.channels.random().createInvite()).code}`;
	} catch {
		invite = "Unable to get invite";
	}

	let guildInfo;
	if (guild) guildInfo = `__**Guild Info**__\nGuild Name: ${guild.name}\nGuild ID: ${guild.id}\nOwner ID: ${guild.ownerID}`;

	const embed = {
		title: "Threat Mitigation Alert",
		timestamp: new Date(),
		color: 16729871,
		description: `User tried crashing a realm where a realm owner was , likely honeypot.
			__**Sender Info**__
			Realm Code: ${realmCode}
			Username: ${user.username}#${user.discriminator}
			User ID: ${user.id}

			${guildInfo}
		`,
		thumbnail: {
			url: guild?.iconURL ?? user.avatarURL
		},
		fields: [
			{
				name: "Invite",
				value: invite
			}
		]
	};
	client.createMessage(logs_channel, { content: "", embed: embed });
}

function generateRandomString(length, charSet) {
	if (!charSet) charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890_-";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += charSet.charAt(Math.floor(Math.random() * charSet.length));
	}
	return result;
}

function getCacheFactory(dbUser) {
	if (!dbUser.linkData) dbUser.linkData = {};

	class CacheFactory {
		async getCached() {
			return dbUser.linkData;
		}
		async setCached(value) {
			dbUser.linkData = value || {};

			try {
				await dbUser.save();
			} catch {
				dbUser = await userModel.findOne({ id: dbUser.id });
				dbUser.linkData = value || {};
				await dbUser.save();
			}
		}
		async setCachedPartial(value) {
			dbUser.linkData = {
				...dbUser.linkData,
				...value
			};

			try {
				await dbUser.save();
			} catch {
				dbUser = await userModel.findOne({ id: dbUser.id });
				dbUser.linkData = {
					...dbUser.linkData,
					...value
				};
				await dbUser.save();
			}
		}
	}
	return function () { return new CacheFactory(); };
}

function snakeToPascalCase(string) {
	const words = string.split("_");
	const pascalCase = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

	return pascalCase.trim();
}

function splitString(str, arrayItemMaxLength = 512) {
	const result = [];
	let count = 0;

	while (count < str.length) {
		const chunk = str.substr(count, arrayItemMaxLength);
		result.push(chunk);
		count += arrayItemMaxLength;
	}

	return result;
}

module.exports = {
	sendHoneyportAlert: sendHoneyportAlert,
	generateRandomString: generateRandomString,
	getCacheFactory: getCacheFactory,
	snakeToPascalCase: snakeToPascalCase,
	splitString: splitString,
	// so we dont have to require the translation file
	...require("./translations/translate.js")
};