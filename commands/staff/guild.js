"use strict";

const { client } = require("../../index.js");

let guildsList;

module.exports = {
	name: "guild",
	description: "Management of all guilds Yern is inside",
	options: [
		{
			type: 1,
			name: "list",
			description: "List all guilds Yern is inside",
			options: [
				{
					type: 4,
					name: "page",
					description: "page for the menu",
					min_value: 1,
					max_value: 30
				}
			]
		},
		{
			type: 1,
			name: "leave",
			description: "Make Yern leave a guild",
			options: [
				{
					type: 3,
					name: "guild_id",
					description: "The guild to leave.",
					required: true,
					min_length: 18,
					max_length: 19
				}
			]
		},
		{
			type: 1,
			name: "lookup",
			description: "Find info regarding a server Yern is inside",
			options: [
				{
					type: 3,
					name: "guild_id",
					description: "The guild to lookup.",
					required: true,
					min_length: 18,
					max_length: 19
				}
			]
		}
	],
	staffOnly: true,
	execute: async (interaction, args) => {
		const { sub_command } = args;

		if (sub_command === "list") {
			const page = args.page ?? 1;
			const lastPage = Math.ceil(client.guilds.size / 30);

			guildsList = [...client.guilds.map(x => x)];

			const embed = {
				title: "Guilds List",
				timestamp: new Date(),
				color: 65280,
				description: getList(page),
				footer: {
					text: `Page ${page} out of ${lastPage}`
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
		} else if (sub_command === "leave") {
			const guild_id = args.guild_id;
			const guild = client.guilds.find(g => g.id === guild_id);

			if (!guild) return interaction.createFollowup({ content: "Unable to find the guild." });

			guild.leave();

			interaction.createFollowup({ content: `Bot has left ${guild.name} (${guild_id})` });
		} else if (sub_command === "lookup") {
			const guild_id = args.guild_id;
			const guild = client.guilds.find(g => g.id === guild_id);

			const embed = {
				title: "Guild Lookup",
				timestamp: new Date(),
				color: 65280,
				description: `
				Name: ${guild.name}
				ID: ${guild_id}
				Member Count: ${guild.memberCount}/${guild.maxMembers}
				Owner: <@${guild.ownerID}> (${guild.ownerID})
				Shard: ${guild.shard.id + 1}
				Created at: ${new Date(guild.createdAt)}
				`,
				thumbnail: {
					url: guild.iconURL
				}
			};

			interaction.createFollowup({ embed: embed });
		}
	},
	componentPressEvent: updateGuildList
};

function getList(page) {
	let guilds = "";

	for (let i = (page - 1) * 30; i < page * 30; i++) {
		const guild = guildsList[i];
		if (!guild) break;

		const { name, id, ownerID, memberCount } = guild;

		guilds += `**${i + 1}\\. ${name}**\nGuild ID: ${id}\nOwner: ${ownerID}\nMember Count: ${memberCount}\n\n`;
	}

	return guilds.replace(/(?<!\\)([|_-])/gm, "\\$1");
}

async function updateGuildList(interaction, custom_id) {
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
	embed.description = getList(newPage);
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
			],
		}]
	});
}