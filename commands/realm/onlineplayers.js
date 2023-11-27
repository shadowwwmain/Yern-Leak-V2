"use strict";

const { sendHoneyportAlert, translateKey } = require("../../util.js");
const { getRealmData } = require("../../common/realms.js");
const { getXboxAccountDataBulk, getClubData } = require("../../common/xbox.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "onlineplayers",
	description: "a list of all online players in the realm",
	options: [
		{
			type: 3,
			name: "code",
			description: "the realm code to check",
			required: true,
			min_length: 11,
			max_length: 11
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { accountID, user } = interaction;
		const realmCode = args.code;

		const realmData = await getRealmData(realmCode, accountID);
		if (realmData.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGetRealmData", { error: realmData.errorMsg }) });

		if (realmData.honeypot && !dbUser.didLink) sendHoneyportAlert(interaction, realmCode);

		let realm = await realmModel.findOne({ id: realmData.id });

		if (!realm) {
			realm = createRealmDefaults({
				id: realmData.id,
				name: realmData.name,
				realmCode: realmCode
			});
			await realm.save();
		}

		if (realm.realmCode !== realmCode && !realmCode.startsWith("=")) {
			realm.realmCode = realmCode;
			realm.save();
		}

		const clubData = await getClubData(accountID, realmData.clubId);
		if (clubData.code) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGetClubData", { error: `${clubData.code} ${clubData.description}` }) });

		const clubPresence = clubData.clubPresence;
		const ingamePlayers = clubPresence.filter(player => player.lastSeenState === "InGame");

		if (ingamePlayers.length === 0) return interaction.createFollowup({ content: translateKey(dbUser.locale, "noPlayersOnline") });

		const userMap = {};

		for (const player of ingamePlayers) {
			userMap[player.xuid] = player.lastSeenTimestamp;
		}

		const userData = await getXboxAccountDataBulk(accountID, Object.keys(userMap));

		let players = ``;

		for (const p in userData) {
			const player = userData[p];
			const currentDevice = player.presenceDetails[0]?.Device ?? translateKey(dbUser.locale, "appearingOffline");

			const { gamertag, xuid, gamerScore, detail } = player;
			const { accountTier } = detail;
			const joinedDate = userMap[xuid];

			players += `**${Number(p) + 1}\\. ${gamertag}**\nXUID: ${xuid}\nJoined: <t:${Math.floor(new Date(joinedDate).getTime() / 1000)}:R> (${joinedDate})\nGamerscore: ${gamerScore}\nAccount Tier: ${accountTier}\nCurrent Device: ${currentDevice}\n\n`;

		}

		const embed = {
			title: translateKey(dbUser.locale, "currentlyOnlinePlayers"),
			description: players,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/realm | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({ embed: embed });
	}
};