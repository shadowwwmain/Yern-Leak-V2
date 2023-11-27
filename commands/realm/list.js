"use strict";

const { translateKey } = require("../../translations/translate.js");
const { realmModel } = require("../../database.js");

const query = { whitelisted: false, realmCode: { $ne: undefined } };

module.exports = {
	name: "list",
	description: "a list of all the realms indexed in the database",
	options: [
		{
			type: 4,
			name: "page",
			description: "page for the menu",
			min_value: 1,
			max_value: 100
		}
	],
	execute: async (interaction, args, dbUser) => {
		const page = args.page ?? 1;

		const lastPage = Math.ceil(await realmModel.countDocuments(query) / 20);

		const embed = {
			title: translateKey(dbUser.locale, "realmsList"),
			description: await getList(page, lastPage),
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: translateKey(dbUser.locale, "pageCount", { page, lastPage })
			}
		};

		interaction.createFollowup({
			embed: embed,
			components: [{
				type: 1,
				components: [
					{
						type: 2,
						label: "<<",
						style: 1,
						custom_id: `{"a":"a","b":${lastPage},"c":1}`
					},
					{
						type: 2,
						label: "<",
						style: 1,
						custom_id: `{"a":"b","b":${lastPage},"c":${page - 1}}`
					},
					{
						type: 2,
						label: ">",
						style: 1,
						custom_id: `{"a":"c","b":${lastPage},"c":${page + 1}}`
					},
					{
						type: 2,
						label: ">>",
						style: 1,
						custom_id: `{"a":"d","b":${lastPage},"c":${lastPage}}`
					}
				],
			}]
		});
	},
	componentPressEvent: updateListMessage
};

async function getList(page, lastPage) {
	let realmsList = "";
	if (lastPage === 0) realmsList += "No realms are currently indexed in the database.";

	const startIndex = (page - 1) * 20;
	const realms = await realmModel.find(query).skip(startIndex).limit(20);

	for (let i = 0; i < 20; i++) {
		const realm = realms[i];
		if (!realm) break;

		const { realmCode, name, id } = realm;

		// Discord's new markdown system introduces Lists. It creates lists based on the number beside a value
		// This lists feature can only go up to 50, so we have to escape the decimal so it wont use the list system
		realmsList += `**${startIndex + i + 1}\\. ${name}**\nRealm Code: ${realmCode}\nRealm ID: ${id}\n\n`;
	}

	return realmsList.replace(/(?<!\\)([|_-])/gm, "\\$1");
}

async function updateListMessage(interaction, custom_id) {
	let { b: lastPage, c: newPage } = JSON.parse(custom_id);

	// backwards compatibility
	if (!lastPage) {
		const data = JSON.parse(custom_id);

		lastPage = data.lastPage;
		newPage = data.newPage;
	}

	/** 
	 * a = full_back
	 * b = back
	 * c = forward
	 * d = full_forward
	*/
	if (newPage < 1 || newPage > lastPage) return interaction.createMessage({ content: `You cannot go any ${newPage < 1 ? "more backwards" : "further"}.`, flags: 64 });

	// we edit the message so if the acknowledge fails it doesnt really matter
	interaction.acknowledge();

	const embed = interaction.message.embeds[0];
	embed.description = await getList(newPage, lastPage);
	embed.footer.text = `Page ${newPage} out of ${lastPage}`;

	interaction.message.edit({
		embed: embed,
		components: [{
			type: 1,
			components: [
				{
					type: 2,
					label: "<<",
					style: 1,
					custom_id: `{"a":"a","b":${lastPage},"c":1}`
				},
				{
					type: 2,
					label: "<",
					style: 1,
					custom_id: `{"a":"b","b":${lastPage},"c":${newPage - 1}}`
				},
				{
					type: 2,
					label: ">",
					style: 1,
					custom_id: `{"a":"c","b":${lastPage},"c":${newPage + 1}}`
				},
				{
					type: 2,
					label: ">>",
					style: 1,
					custom_id: `{"a":"d","b":${lastPage},"c":${lastPage}}`
				}
			]
		}]
	});
}