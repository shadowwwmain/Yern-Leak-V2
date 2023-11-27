"use strict";

const { sendHoneyportAlert, translateKey } = require("../../util.js");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "ipresolve",
	description: "find the realm IP & port for a realm",
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
		const { user } = interaction;
		const realmCode = args.code;

		const realmData = await getRealmData(realmCode, dbUser.didLink ? user.id : undefined);
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

		if (realm.whitelisted) return interaction.createFollowup({ content: translateKey(dbUser.locale, "realmWhitelisted") });

		const address = await getRealmAddress(realmCode, dbUser.didLink ? user.id : undefined);
		if (address.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGetRealmIP", { error: address.errorMsg }) });

		const embed = {
			title: translateKey(dbUser.locale, "realmIpResolver"),
			timestamp: new Date(),
			color: 65280,
			fields: [
				{
					name: translateKey(dbUser.locale, "realmIp"),
					value: address.ip
				},
				{
					name: translateKey(dbUser.locale, "realmPort"),
					value: address.port
				}
			],
			footer: {
				text: `/ipresolve | Command used by ${user.username}`,
				icon_url: user.avatarURL
			}
		};

		interaction.createFollowup({ embed: embed });
	}
};