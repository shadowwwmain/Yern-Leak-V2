"use strict";

const { getRealmData } = require("../../common/realms.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

module.exports = {
	name: "whitelist",
	description: "management of Yern Whitelist",
	options: [{
		type: 1,
		name: "add",
		description: "adds a realm to the whitelist",
		options: [
			{
				type: 3,
				name: "code",
				description: "realm to add to the whitelist",
				required: true,
				min_length: 11,
				max_length: 11
			}
		]
	},
	{
		type: 1,
		name: "remove",
		description: "removes a realm to the whitelist",
		options: [
			{
				type: 3,
				name: "code",
				description: "the realm to remove from the whitelist",
				required: true,
				min_length: 11,
				max_length: 11
			}
		]
	},
	{
		type: 1,
		name: "query",
		description: "query a realm for whitelist status",
		options: [
			{
				type: 3,
				name: "code",
				description: "realm to check",
				required: true,
				min_length: 11,
				max_length: 11
			}
		]
	}],
	staffOnly: true,
	execute: async (interaction, args, dbUser) => {
		const { user } = interaction;
		const { sub_command, code } = args;

		const realmData = await getRealmData(code, dbUser.didLink ? user.id : undefined);

		if(realmData.errorMsg) return interaction.createFollowup({ content: `Unable to get realm data.\nError: ${realmData.errorMsg}`});

		const { id, name } = realmData;

		let realm = await realmModel.findOne({id:id});

		if(!realm) {
			realm = createRealmDefaults({
				id: id,
				name: name,
				realmCode: code
			});
			await realm.save();
		}

		if(sub_command === "add") {
			if(realm.whitelisted) return interaction.createFollowup({content: "Error: This realm is already whitelisted."});

			realm.whitelisted = true;
			interaction.createFollowup({ content: "This realm has now been added to the whitelist."});
		} else if(sub_command === "remove") {
			if(!realm.whitelisted) return interaction.createFollowup({content: "Error: This realm is not on the whitelist."});

			realm.whitelisted = false;
			interaction.createFollowup({ content: "This realm has been removed the whitelist."});
		} else if(sub_command === "query") {
			interaction.createFollowup({ content: `This realm on ${realm.whitelisted ? "**is on**" : "**is not**"} the whitelist`});
			return;
		}
		await realm.save();
	}
};