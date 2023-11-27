"use strict";

const { sendHoneyportAlert, translateKey } = require("../../util.js");
const { getRealmData } = require("../../common/realms.js");
const { gamertagToXuid, getClubData} = require("../../common/xbox.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "lastseen",
	description: "find when a user last joined the realm",
	options: [
		{
			type: 3,
			name: "code",
			description: "the realm code to check",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 3,
			name: "user",
			description: "gamertag of a user to check",
			required: true,
			min_length: 3,
			max_length: 16
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { accountID, user } = interaction;
		const { code: realmCode, user: requestedUser } = args;

		const realmData = await getRealmData(realmCode, accountID);

		const unableToGetRealmDataEmbed = {
			title: "Last Seen",
			description: `${translateKey(dbUser.locale, "unableToGetRealmData")}`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/lastseen | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		if(realmData.errorMsg) return interaction.createFollowup({ embed: unableToGetRealmDataEmbed });

		if(realmData.honeypot && !dbUser.didLink) sendHoneyportAlert(interaction, realmCode);

		let realm = await realmModel.findOne({id:realmData.id});

		if(!realm) {
			realm = createRealmDefaults({
				id: realmData.id,
				name: realmData.name,
				realmCode: realmCode
			});
			await realm.save();
		}

		if(realm.realmCode !== realmCode && !realmCode.startsWith("=")) {
			realm.realmCode = realmCode;
			realm.save();
		}

		const clubData = await getClubData(accountID, realmData.clubId);

		const unableToGetClubDataEmbed = {
			title: "Last Seen",
			description: `${translateKey(dbUser.locale, "unableToGetClubData")}`,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/lastseen | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		if(clubData.code) return interaction.createFollowup({ embed: unableToGetClubDataEmbed});

		const clubPresence = clubData.clubPresence;

		let xuid = requestedUser;
		if(requestedUser.length !== 16 && !requestedUser.startsWith("2")) {
			xuid = await gamertagToXuid(accountID, requestedUser);

			const gamerTagInvaildEmbed = {
				title: "Last Seen",
				description: translateKey(dbUser.locale, "userNotFound"),
				timestamp: new Date(),
				color: 65280,
				footer: {
					text: `/lastseen | Command used by ${user.username}`,
					icon_url: user.avatarURL
				}
			};

			if(!xuid) return interaction.createFollowup({ embed: gamerTagInvaildEmbed });
		}

		const realmUser = clubPresence.find(player => player.xuid === xuid);

		const userNotFoundEmbed = {
			title: "Last Seen",
			description: translateKey(dbUser.locale, "userNotFound"),
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/lastseen | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		if(!realmUser) return interaction.createFollowup({ embed: userNotFoundEmbed });

		let date = new Date(realmUser.lastSeenTimestamp);
		date = String(date).replace("GMT-0600 (Central Standard Time)", "");

		const SuccessfulEmbed = {
			title: "Last Seen",
			description: translateKey(dbUser.locale, "userFoundAt", {date}),
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/lastseen | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({ embed: SuccessfulEmbed });
	}
};