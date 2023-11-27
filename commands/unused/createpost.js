"use strict";

const { generateRandomString, translateKey} = require("../../util.js");
const { getRealmData } = require("../../common/realms.js");
const { createClubPost } = require("../../common/xbox.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "createpost",
	description: "Create a post in the realm feed",
	options: [
		{
			type: 3,
			name: "code",
			description: "The realm code to create a post in",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 3,
			name: "text",
			description: "What should the feed post have as its text",
			min_length: 1,
			max_length: 4000
		}
	],
	requiresLink: true,
	// Creating feed posts have a ratelimit of 3 posts per 15 seconds
	cooldown: 5000,
	// Premium users can create posts faster, but they can get ratelimited from the Xbox API
	premiumCooldown: 3000,
	execute: async (interaction, args, dbUser) => {
		const { accountID } = interaction;
		const realmCode = args.code;

		const realmData = await getRealmData(realmCode, accountID);

		if(realmData.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGetRealmData", {error: realmData.errorMsg})});

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

		if(realm.whitelisted) return interaction.createFollowup({content: translateKey(dbUser.locale, "realmWhitelisted")});

		const output = await createClubPost(accountID, realmData.clubId, args.text ?? getDefaultText());
		if(output.errorMsg) return interaction.createFollowup({content:translateKey(dbUser.locale, "unableToCreateFeedPost", {error: output.errorMsg})});

		interaction.createFollowup({content:translateKey(dbUser.locale, "successfullyCreatedFeedPost", {realmName: realmData.name})});
	}
};

// Feed title limit is around 10k-11k characters long BEFORE 1.19.80. Now it is around 9.5k.
function getDefaultText() {
	let msg = "";
	for(let i = 0; i < 165; i++) {
		msg += `§l§n§${generateRandomString(1, "abcdef1234567890")}join https://discord.gg/antip2w or else. ${generateRandomString(5)}\n`;
	}

	console.log(msg.length);
	return msg;
}
