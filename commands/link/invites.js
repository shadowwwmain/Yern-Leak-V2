"use strict";

const { getInvites, acceptInvite } = require("../../common/realms.js");
const { getXboxUserData } = require("../../common/xbox.js");

const invitesCache = new Map();

module.exports = {
	name: "invites",
	description: "a list of pending realm invites.",
	requireLink: true,
	execute: async (interaction, args) => {
		const { user } = interaction;
		const page = args.page ?? 1;

		const invites = await getInvites(user.id);

		if (invites.length === 0) return interaction.createFollowup({ content: "You don't have any pending invites." });

		invitesCache.set(user.id, invites);

		const lastPage = Math.ceil(invites.length / 20);

		const embed = {
			title: "Invites List",
			description: await getList(invites, page),
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
					options: await getInvitesCache(user.id, page),
					placeholder: "Accept invite"
				}
			]
		}];

		interaction.createFollowup({
			embed: embed,
			components: MessageComponents
		});
	},
	componentPressEvent: updateListMessage,
	componentSelectEvent: acceptInviteButton
};

async function getList(allInvites, page) {
	let realms = "";

	for (let i = (page - 1) * 20; i < 20 * page; i++) {
		const realm = allInvites[i];
		if (!realm) break;

		const inviteTime = new Date(realm.date);
		realms += `**${i + 1}\\. ${realm.worldName}**\nRealm ID: ${realm.invitationId}\nOwner: ${realm.worldOwnerName}\nInvited: <t:${Math.floor(inviteTime.getTime() / 1000)}:R> (${inviteTime.toISOString()})\n\n`;
	}

	return realms;
}

async function getInvitesCache(userId, page) {
	const allRealms = invitesCache.get(userId);

	const options = [];

	for (let i = (page - 1) * 20; i < 20 * page; i++) {
		const realm = allRealms[i];
		if (!realm) break;

		options.push({
			label: realm.worldName,
			value: JSON.stringify({ id: realm.invitationId, name: realm.worldName })
		});

		// log info about the inviter
		getXboxUserData(userId, realm.worldOwnerUuid);
	}

	return options;
}

async function acceptInviteButton(interaction) {
	const { user } = interaction;
	const { id, name } = JSON.parse(interaction.data.values[0]);

	await interaction.defer();

	const status = await acceptInvite(user.id, id);

	if (status.errorMsg) {
		return interaction.createFollowup({ content: `Unable to accept the invite for ${name}\nError: ${status.errorMsg}` });
	}

	interaction.createFollowup({ content: `Successfully accepted the realm invite for ${name}!` });
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
	if (newPage < 1 || newPage > lastPage) return interaction.createMessage({ content: `You can't go any ${newPage < 1 ? "more backwards" : "further"}.`, flags: 64 });

	// we edit the message so if the acknowledge fails it doesnt really matter
	interaction.acknowledge();

	let realmsInvitesCache = invitesCache.get(user.id);

	// incase bot reboots, realms invite cache would be reset
	// this regenerates realms invites to fix this issue
	if (!realmsInvitesCache) {
		realmsInvitesCache = await getInvites(user.id);
		realmsInvitesCache.set(user.id, realmsInvitesCache);
	}

	const embed = interaction.message.embeds[0];
	embed.description = await getList(realmsInvitesCache, newPage);
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
					options: await getInvitesCache(user.id, newPage)
				}
			]
		}]
	});
}