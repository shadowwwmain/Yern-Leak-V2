"use strict";

const { getRealmData, invitePlayers } = require("../../common/realms.js");
const { getClubData } = require("../../common/xbox.js");
const { realmModel, accountsModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "massinvite",
	description: "Mass invite players into your own realm",
	options: [
		{
			type: 3,
			name: "code",
			description: "The realm code to invite players to",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 3,
			name: "invite_from_code",
			description: "The realm to invite players from (people in this realm will be invited)",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 4,
			name: "members",
			description: "How much players to invite to your realm",
			min_value: 1,
			max_value: 10
		},
		{
			type: 5,
			name: "database",
			description: "Find xbox accounts to mass-invite from the Crashary Database"
		}
	],
	staffOnly: true,
	requireLink: true,
	cooldown: 15000,
	premiumCooldown: 3000,
	execute: async (interaction, args, dbUser) => {
		if(!dbUser.premium) {
			if(args.members > 250) return interaction.createFollowup({content:"Free accounts can only mass invite 250 members at a time. If you would like to mass-invite up to 1,000 players you need Crashary Premium. If you are interested in getting Crashary Premium, use the </premium info:1092137585993863248> command."});
			if(args.database) return interaction.createFollowup({content:"Only Crashary Premium subscribers may mass-invite people from the Crashary Database. If you are interested in getting Crashary Premium, use the </premium info:1092137585993863248> command."});
		}

		const realmData1 = await getRealmDataWithOtherStuff(args.code, dbUser);
		const realmData2 = await getRealmDataWithOtherStuff(args.invite_from_code, dbUser);

		if(realmData1.errorMsg) return interaction.createFollowup({content:`Unable to get realm data for realm 1\nError: ${realmData1.errorMsg}`});
		if(realmData2.errorMsg) return interaction.createFollowup({content:`Unable to get realm data for realm 2\nError: ${realmData2.errorMsg}`});
	
		if(realmData2.whitelisted) return interaction.createFollowup({content:"Realm code 2 is whitelisted. It cannot be used for mass-invites."});

		const count = args.members ?? 10;
		const clubData = await getClubData(dbUser.id, realmData2.clubId);
		if(clubData.code) return interaction.createFollowup({content:`Unable to get club data.\nError: ${clubData.code} ${clubData.description}`});

		const msg = await interaction.createFollowup({content:`Mass inviting players, please wait...`});

		const members = clubData.clubPresence.slice(0, count);

		const xuids = [];

		for(const member of members) {
			const { xuid } = member;

			xuids.push(xuid);
		}

		if(args.database) {
			const dbAccounts = await accountsModel.find({hidden:false});

			const allAccounts = dbAccounts.slice(0, members - xuids.length).sort(() => 0.5 - Math.random());

			for(const account of allAccounts) {
				const { xuid } = account;

				// ignore duplicates
				if(xuids.includes(xuid)) continue;

				xuids.push(xuid);
			}
		}

		const status = await invitePlayers(dbUser.id, realmData1.id, xuids);

		if(status.errorMsg && !status.errorMsg.includes("504 Gateway")) return msg.edit({content:`Unable to mass invite players.\nError: ${status.errorMsg}`});

		msg.edit({content:`Successfully invited ${xuids.length} player${xuids.length !== 1 ? "s" : ""} to your realm.`});
	}
};

async function getRealmDataWithOtherStuff(realmCode, dbUser) {
	const realmData = await getRealmData(realmCode, dbUser.didLink ? dbUser.id : undefined);

	if(realmData.errorMsg) return realmData;

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

	realmData.whitelisted = realm.whitelisted;

	return realmData;
}