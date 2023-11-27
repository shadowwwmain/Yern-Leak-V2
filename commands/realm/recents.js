"use strict";

const { sendHoneyportAlert, translateKey } = require("../../util.js");
const { getRealmData } = require("../../common/realms.js");
const { getXboxUserData, getXboxAccountDataBulk, getClubData } = require("../../common/xbox.js");
const { userModel, realmModel, createRealmDefaults } = require("../../database.js");

const recentsCache = new Map();

module.exports = {
	name: "recents",
	description: "finds the recent members who joined/played on the realm",
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

		const clubPresence = clubData.clubPresence.slice(0, 24);

		const userMap = {};

		for (const player of clubPresence) {
			userMap[player.xuid] = player.lastSeenTimestamp;
		}

		const userData = await getXboxAccountDataBulk(accountID, Object.keys(userMap));

		let players = ``;
		const embedOptions = [
			{
				label: translateKey(dbUser.locale, "returnToRecents"),
				value: "-1",
				emoji: {
					name: "arrow_left",
					id: "1103138573202489497"
				}
			}
		];

		for (const p in userData) {
			const player = userData[p];

			const { xuid, gamertag } = player;
			const joinDate = userMap[xuid];

			players += `**${Number(p) + 1}\\. ${gamertag}** - Joined <t:${Math.floor(new Date(joinDate).getTime() / 1000)}:R> (${joinDate})\n`;

			embedOptions.push({
				label: gamertag,
				value: xuid,
				description: xuid,
				emoji: Math.random() > 0.5 ? { name: "steve", id: "1103139724513775656" } : { name: "alex", id: "1103139754482085958" }
			});
		}

		recentsCache.set(realm.id, players);

		// clear cache after 15 minutes to save memory
		setTimeout(() => {
			recentsCache.delete(realm.id);
		}, 900000);

		const embed = {
			title: "Recently Joined Players",
			description: players,
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `/recents | Command used by ${user.username}` + translateKey(dbUser.locale, "selectUserInDropdown"),
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({
			embed: embed,
			components: [
				{
					type: 1,
					components: [
						{
							type: 3,
							custom_id: realm.id,
							options: embedOptions,
							placeholder: translateKey(dbUser.locale, "selectUser")
						}
					]
				}
			]
		});
	},
	componentSelectEvent: getPlayerInfo
};

async function getPlayerInfo(interaction, custom_id) {
	const xuid = interaction.data.values[0];

	if (xuid === "-1") {
		const embed = interaction.message.embeds[0];
		const recents = recentsCache.get(Number(custom_id));

		if (!recents) return interaction.createMessage({
			content: "This option is no longer available",
			flags: 64
		});

		interaction.acknowledge();

		embed.title = "Recently Joined Players";
		embed.description = recents;
		embed.color = 65280;
		embed.footer = {
			text: `/recents | Command used by ${user.username}`,
			icon_url: user.avatarURL
		}
		delete embed.fields;
		delete embed.thumbnail;
		return interaction.message.edit({ embed: embed });
	}

	// we edit the message so if the acknowledge fails it doesnt really matter
	interaction.acknowledge();

	const user = interaction.user;
	const dbUser = await userModel.findOne({ id: user.id });

	const userData = await getXboxUserData(dbUser.didLink ? user.id : undefined, xuid);

	const { realName, hexXuid, displayName, displayPicRaw, gamerScore, xboxOneRep, presenceState, presenceText } = userData;
	const { location, accountTier, tenure, followerCount, followingCount } = userData.detail;

	const embed = interaction.message.embeds[0];

	embed.title = "Recently Joined Player Info";
	embed.description = "";
	embed.color = parseInt(userData.preferredColor.primaryColor, 16);
	embed.fields = [
		{
			name: "Basic Info",
			value: `Gamertag: \`${displayName}\`\nXUID (Decimal): \`${xuid}\`\nXUID (Hexadecimal): \`${hexXuid}\``
		},
		{
			name: "Additional Info",
			value: `
			Real Name: \`${realName}\`
			Location: \`${location}\`

			Gamerscore: \`${gamerScore}\`
			Followers: \`${followerCount}\`
			Following: \`${followingCount}\`
			Account Tier: \`${accountTier}\`
			Tenure: \`${tenure}\`
			Reputation: \`${xboxOneRep}\`
			`
		},
		{
			name: "User Presence",
			value: `${presenceState} - ${presenceText}`
		}
	];
	embed.thumbnail = {
		url: displayPicRaw
	};
	embed.footer = {
		text: `/recents | Command used by ${user.username}`,
		icon_url: user.avatarURL
	}

	interaction.message.edit({ embed: embed });
}