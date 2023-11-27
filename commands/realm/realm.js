"use strict";

const { sendHoneyportAlert, translateKey } = require("../../util.js");
const { getRealmData } = require("../../common/realms.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "realm",
	description: "get info regarding a realm, such as owner, realm name, realm creation data and joined member count",
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
			type: 5,
			name: "turbo",
			description: "skip fetching certain data features to make the command run way faster",
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		const realmCode = args.code;

		const realmData = await getRealmData(realmCode, dbUser.didLink ? user.id : undefined, !args.turbo);

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

		delete realmData.honeypot;
		// if user uses a Yern ID to get realm info, make it show the realm code from the database
		realmData.realmCode = realm.realmCode ?? "N/A";
		realmData.yern_id = realm.cid ?? "";
		realmData.totalBans = realm.totalBans;
		realmData.whitelisted = realm.whitelisted;

		const embed = {
			title: translateKey(dbUser.locale, "realmInfo"),
			description: `\`\`\`json\n${JSON.stringify(realmData, null, 2)}\`\`\``,
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
