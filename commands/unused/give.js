"use strict";

const minecraftData = require("minecraft-data");
const devices = require("../../data/devices.json");
const { getRealmData, getRealmAddress } = require("../../common/realms.js");
const { createBot, parseKickMessage } = require("../../common/bp-dp.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

const { itemsArray, itemsByName } = minecraftData("bedrock_1.19.80");

const check = "<:success:1170321325886287882>";
const cross = "<:error:1170321352587219024>";
const loading = "<a:loading:1170321149759074355>";
const none = ":black_circle:";

module.exports = {
	name: "give",
	description: "Give yourself any item you want on a realm. (Requires a linked account and creative mode)",
	options: [
		{
			type: 3,
			name: "code",
			description: "the realm code to join",
			required: true,
			min_length: 11,
			max_length: 11
		},
		{
			type: 3,
			name: "item",
			description: "The item to give",
			required: true,
			min_length: 3,
			max_length: 30,
			autocomplete: true
		},
		{
			type: 4,
			name: "amount",
			description: "How much of the item to give",
			min_value: 1,
			// physical limit on stack amount
			max_value: 127
		},
		{
			type: 4,
			name: "data",
			description: "Data ID for the item",
			min_value: 0,
			max_value: 128
		},
		/*
		{
			type: 3,
			name: "nbt",
			description: "Nbt data to apply to the item",
			min_length: 10,
			max_length: 2000
		},
		*/
		{
			type: 4,
			name: "device_os",
			description: "the device to spoof as",
			choices: devices
		}
	],
	requireLink: true,
	execute: async (interaction, args, dbUser) => {
		const { accountID } = interaction;
		const { code: realmCode, device_os } = args;

		const item = args.item.replace("minecraft:", "").toLowerCase().trim();
		const itemData = itemsByName[item];

		if (!itemData && !(item.includes(":"))) return interaction.createFollowup({
			content: `\`${item}\` is not a valid item name.`
		});

		let nbt;
		/*
		if(args.nbt) {
			try {
				nbt = parseNbt(args.nbt);
			} catch (error) {
				console.error(error);
				return interaction.createFollowup({
					content: "The provided nbt is invalid or corrupt."
				});
			}
		}
		*/

		const embed = {
			title: "Give Item",
			description: `${loading} Getting realm identity\n${none} Connecting to realm\n${none} Giving item`,
			timestamp: new Date(),
			color: 65280,
			author: {
				name: "Yern",
				icon_url: "https://cdn.discordapp.com/avatars/1169735844941271100/e7b90b26163a5e67e4201a03509815dd.webp?size=4096"
			}
		};

		const msg = await interaction.createFollowup({ embed: embed });

		const realmData = await getRealmData(realmCode, accountID);

		if (realmData.errorMsg) {
			embed.color = 16729871;
			embed.description = `${cross} Getting realm identity\n${none} Connecting to realm\n${none} Giving item\n\nError Log:\n${realmData.errorMsg}`;

			return msg.edit({ embed: embed });
		}

		let realm = await realmModel.findOne({ id: realmData.id });

		if (!realm) {
			realm = createRealmDefaults({
				id: realmData.id,
				name: realmData.name,
				realmCode: realmCode
			});
			realm.save();
		}

		if (realm.realmCode !== realmCode && !realmCode.startsWith("=")) {
			realm.realmCode = realmCode;
			realm.save();
		}

		if (realm.whitelisted) {
			embed.color = 16729871;
			embed.description = `${check} Getting realm identity\n${cross} Connecting to realm\n${none} Giving item\n\nError Log: Realm is whitelisted.`;

			return msg.edit({ embed: embed });
		}

		const address = await getRealmAddress(realmData.id, accountID);

		if (!address || address.errorMsg) {
			embed.color = 16729871;
			embed.description = `${check} Getting realm identity\n${cross} Connecting to realm\n${none} Giving item\n\nError Log:\n${address.errorMsg}`;

			return msg.edit({ embed: embed });
		}

		embed.description = `${check} Getting realm identity\n${loading} Connecting to realm\n${none} Giving item`;
		msg.edit({ embed: embed });

		let itemStates;
		const client = createBot(address, device_os, dbUser);

		client.on("start_game", (packet) => {
			if (packet.player_gamemode !== "creative") {
				client.disconnect();

				embed.color = 16729871;
				embed.description = `${check} Getting realm identity\n${cross} Connecting to realm\n${none} Giving item\n\nError Log:\nUser is not in Creative.`;
				msg.edit({ embed: embed });

				return;
			}

			itemStates = packet.itemstates;

			embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${loading} Giving item`;
			msg.edit({ embed: embed });
		});

		client.on("inventory_content", (packet) => {
			if (packet.window_id !== "inventory") return;

			/*
			let slot = (args.slot ?? 1) - 1;
			*/

			let slot;

			// find empty slot
			for (const i in packet.input) {
				const _item = packet.input[i];
				if (_item.network_id === 0) {
					slot = i;
					break;
				}
			}

			if (!slot) {
				client.disconnect();

				embed.color = 16729871;
				embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${cross} Giving item\n\nError Log:\nNo empty inventory slots. Remove a item from your inventory and try again.`;
				return msg.edit({ embed: embed });
			}

			const itemState = itemStates.find(state => state.name === (itemData.name ? `minecraft:${itemData.name}` : item));

			if (!itemState) {
				client.disconnect();

				embed.color = 16729871;
				embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${cross} Giving item\n\nError Log:\nInvalid item name.`;
				return msg.edit({ embed: embed });
			}

			const oldItem = {
				network_id: 0
			};

			const newItem = {
				network_id: itemState.runtime_id,
				count: args.count ?? itemData.stackSize ?? 1,
				metadata: args.data ?? 0,
				has_stack_id: 0,
				block_runtime_id: 0,
				extra: {
					has_nbt: 0,
					can_place_on: [],
					can_destroy: []
				}
			};

			if (nbt) {
				// incase the person puts a ".nbt load" nbt insted of ".nbt write" nbt
				const value = nbt.value;
				if (value.tag && value.Count && value.Name) {
					newItem.extra.can_place_on = value.CanPlaceOn?.value?.value ?? [];
					newItem.extra.can_destroy = value.CanDestroy?.value?.value ?? [];

					nbt = {
						type: "compound",
						value: value.tag.value,
						name: ""
					};
				}

				newItem.extra.has_nbt = true;
				newItem.extra.nbt = {
					version: 1,
					nbt: nbt
				};
			}

			/*
			const inventory_transaction_packet = {
				transaction: {
					legacy: {
						legacy_request_id: 0
					},
					transaction_type: "normal",
					actions: [{
						source_type: "container",
						inventory_id: "inventory",
						slot: slot,
						old_item: oldItem,
						new_item: newItem
					},
					{
						source_type: "craft",
						action: 0,
						slot: slot,
						old_item: newItem,
						new_item: oldItem
					}]
				}
			};
			*/

			const inventory_transaction_packet = {
				transaction: {
					legacy: {
						legacy_request_id: 0
					},
					transaction_type: "normal",
					actions: [
						{
							source_type: "container",
							inventory_id: "inventory",
							slot: slot,
							old_item: oldItem,
							new_item: newItem
						},
						{
							source_type: "creative",
							slot: 1,
							old_item: newItem,
							new_item: oldItem
						}]
				}
			};

			client.write("inventory_transaction", inventory_transaction_packet);

			client.disconnect();

			embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${check} Giving item\n\nOperation Complete.`;
			msg.edit({ embed: embed });
		});

		client.on("kick", (reason) => {
			embed.color = 16729871;
			embed.description = `${check} Getting realm identity\n${check} Connecting to realm\n${cross} Finding world data\n\nError Log:\n${parseKickMessage(reason.message)}`;

			msg.edit({ embed: embed });
		});
	},
	autocompleteEvent: autocompleteEvent
};

function autocompleteEvent(interaction, args) {
	const itemName = args.value.toLowerCase();

	const results = [];

	const items = itemsArray.filter(({ name }) => name.includes(itemName));

	for (const item of items) {
		if (results.length > 24) break;
		const name = item.name;

		if (name === "air") continue;

		if (name.includes(itemName)) results.push({ name: `minecraft:${name}`, value: name });
	}

	interaction.result(results);
}
