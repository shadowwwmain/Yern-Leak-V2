"use strict";

const { generateRandomString } = require("../../util.js");
const { getRealmsList } = require("../../common/realms.js");

const { realmModel, createRealmDefaults } = require("../../database.js");

const realmsCache = new Map();

module.exports = {
	name: "realmlist",
	description: "get a list of every realm you joined. (Linked account)",
	options: [
		{
			type: 4,
			name: "page",
			description: "what page for the menu",
			min_value: 1,
			max_value: 30
		}
	],
	requireLink: true,
	execute: async (interaction, args) => {
		const { user } = interaction;
		const page = args.page ?? 1;

		const allRealms = await getRealmsList(user.id);

		realmsCache.set(user.id, allRealms);

		// delete realms list cache after 3 minutes to save memory
		setTimeout(() => {
			realmsCache.delete(user.id);
		}, 180000);

		const lastPage = Math.ceil(allRealms.length / 20);

		const embed = {
			title: "Realms list",
			description: await getList(allRealms, page),
			timestamp: new Date(),
			color: 65280,
			footer: {
				text: `Page ${page} out of ${lastPage}`
			}
		};

		const MessageComponents = [{
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
		},
		{
			type: 1,
			components: [
				{
					type: 3,
					custom_id: "a",
					options: await getCrashableRealms(user.id, page),
					placeholder: "Select a realm to get its Yern ID"
				}
			]
		}];

		interaction.createFollowup({
			embed: embed,
			components: MessageComponents
		});
	},
	componentPressEvent: updateListMessage,
	componentSelectEvent: getYernID
};

async function getList(allRealms, page) {
	let realmsList = "Your account is inside these realms:";
	if (allRealms.length === 0) realmsList += "No realms found.";

	const startIndex = (page - 1) * 20;
	const dbRealms = await realmModel.find({ id: { $in: allRealms.slice(startIndex, 20).map(r => r.id) } });

	for (let i = startIndex; i < page * 20; i++) {
		const realm = allRealms[i];
		if (!realm) break;

		const { name, id } = realm;

		realmsList += `\n\n**${i + 1}\\. ${name}**\nRealm ID: ${id}`;

		const dbRealm = dbRealms.find(r => r.id === id);
		if (dbRealm?.realmCode) realmsList += `\nRealm Code: ${dbRealm.realmCode}`;
	}

	return realmsList.replace(/(?<!\\)([|_-])/gm, "\\$1");
}

async function updateListMessage(interaction, custom_id) {
	const { user } = interaction;
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

	let realmsListCache = realmsCache.get(user.id);

	// incase bot reboots, realms list cache would be reset
	// this regenerates realms list to fix this issue
	if (!realmsListCache) {
		realmsListCache = await getRealmsList(user.id);
		realmsCache.set(user.id, realmsListCache);

		setTimeout(() => {
			realmsCache.delete(user.id);
		}, 180000);
	}

	const embed = interaction.message.embeds[0];
	embed.description = await getList(realmsListCache, newPage);
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
		},
		{
			type: 1,
			components: [
				{
					type: 3,
					custom_id: "a",
					options: await getCrashableRealms(user.id, newPage),
					placeholder: "Select a realm to get its Yern ID"
				}
			]
		}]
	});
}

async function getYernID(interaction) {
	try {
		await interaction.acknowledge();
	} catch {
		return;
	}

	const { id, name } = JSON.parse(interaction.data.values[0]);

	if (!id || !name) return;

	let dbRealm = await realmModel.findOne({ id: id });

	if (!dbRealm) {
		dbRealm = createRealmDefaults({
			id: id,
			name: name,
			realmCode: null
		});
		dbRealm.save();
	}

	if (!dbRealm.cid) {
		dbRealm.cid = `=${generateRandomString(10)}`;
		dbRealm.save();
	}

	const embed = {
		title: "Yern ID",
		timestamp: new Date(),
		color: 65280,
		description: `A Yern ID has been generated for ${name}.\n\nYou can use this ID instead of a realm code for all Yern commands.`,
		fields: [
			{
				name: "Yern ID",
				value: dbRealm.cid
			}
		]
	};

	interaction.createFollowup({ embed: embed });
}

async function getCrashableRealms(userId, page) {
	const allRealms = realmsCache.get(userId);

	const options = [];

	for (let i = (page - 1) * 20; i < 20 * page; i++) {
		const realm = allRealms[i];
		if (!realm) break;

		const dbRealm = await realmModel.findOne({ id: realm.id });
		const { id, name, state, expired, expiredTrial } = realm;

		if (state === "CLOSED" || expired || expiredTrial || dbRealm?.whitelisted) continue;

		options.push({
			label: name,
			value: JSON.stringify({ id, name })
		});
	}

	if (options.length === 0) {
		options.push({
			label: "No valid realms found.",
			value: '{"id":null,"name":null}'
		});
	}

	return options;
}