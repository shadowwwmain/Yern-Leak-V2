"use strict";

const { translateKey } = require("../../translations/translate.js");
const { gamertagToXuid, getXboxUserData, getMutualClubs } = require("../../common/xbox.js");

module.exports = {
	name: "lookup",
	description: "info regarding an xbox username",
	options: [
		{
			type: 3,
			name: "user",
			description: "info regarding an xbox account with their gamertag",
			required: true,
			min_length: 3,
			max_length: 16
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		const { accountID } = interaction;
		const requestedUser = args.user;

		const invalidGamertag = translateKey(dbUser.locale, "gamertagInvalid");

		if (requestedUser.match(/[^A-Za-z0-9- ]/)) return interaction.createFollowup(invalidGamertag);

		let xuid = requestedUser;
		if (requestedUser.length !== 16 && !requestedUser.startsWith("2")) {
			xuid = await gamertagToXuid(accountID, requestedUser);

			if (!xuid) return interaction.createFollowup(invalidGamertag);
		}

		const userData = await getXboxUserData(accountID, xuid);
		if (!userData) return interaction.createFollowup(invalidGamertag);

		const { hexXuid, displayName, displayPicRaw, realName, gamerScore, xboxOneRep, presenceState, presenceText, linkedAccounts } = userData;
		const { location, accountTier, tenure, followerCount, followingCount, watermarks } = userData.detail;

		const embed = {
			title: translateKey(dbUser.locale, "accountLookup"),
			timestamp: new Date(),
			color: parseInt(userData.preferredColor.primaryColor, 16),
			thumbnail: {
				url: displayPicRaw
			},
			fields: [
				{
					name: translateKey(dbUser.locale, "basicInfo"),
					value: `Gamertag: \`${displayName}\`\nXUID (Decimal): \`${xuid}\`\nXUID (Hexadecimal): \`${hexXuid}\``
				},
				{
					name: translateKey(dbUser.locale, "additionalInfo"),
					value: `
					Real Name: \`${realName}\`
					Location: \`${location}\`

					Gamerscore: \`${gamerScore}\`
					Followers: \`${followerCount}\`
					Following: \`${followingCount}\`
					Account Tier: \`${accountTier}\`
					Tenure: \`${tenure}\`
					Reputation: \`${xboxOneRep}\`
					Xbox Staff: \`${watermarks.length >= 1 ? `True (Part of: ${watermarks.join(", ")})` : "False"}\`
					`
				},
				{
					name: translateKey(dbUser.locale, "userPresence"),
					value: `${presenceState} - ${presenceText}`
				}
			],
			footer: {
				text: `/lookup | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		const bio = userData.detail.bio;

		if (bio.trim() !== "") {
			embed.fields.push({
				name: "Bio",
				value: bio
			});
		}

		if (linkedAccounts.length >= 1) {
			let connections = "";

			let count = 0;
			for (const connection of linkedAccounts) {
				count++;
				const { networkName, displayName, deeplink } = connection;

				connections += `**${count}\\. ${networkName}**\nName: ${displayName}\nLink: ${deeplink}\n\n`;
			}

			embed.fields.push({
				name: translateKey(dbUser.locale, "connections"),
				value: connections
			});
		}

		if (dbUser.didLink) {
			const clubs = await getMutualClubs(accountID, xuid);
			let count = 0;
			const realms = [];
			for (const club of clubs) {
				if (club.clubType.localizedTitleFamilyName !== "Minecraft Realm") continue;

				count++;
				if (count > 25) break;

				realms.push(club.profile.name.value);
			}

			if (realms.length >= 1) embed.fields.push({
				name: `${translateKey(dbUser.locale, "mutualRealms")} (${realms.length})`,
				value: realms.join("\n")
			});
		}

		interaction.createFollowup({ embed: embed });
	}
};
