"use strict";

const { sendHoneyportAlert, translateKey } = require("../../util.js");
const { getRealmData } = require("../../common/realms.js");
const { getClubFeed } = require("../../common/xbox.js");
const { realmModel, createRealmDefaults } = require("../../database.js");

const feedCache = new Map();

module.exports = {
	name: "realmfeed",
	description: "recent posts in the realm feed",
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
			type: 4,
			name: "page",
			description: "how many posts to view",
			min_value: 1,
			max_value: 5
		}
	],
	execute: async (interaction, args, dbUser) => {
		const { accountID, user } = interaction;
		const realmCode = args.code;

		const realmData = await getRealmData(realmCode, accountID, true);

		if(realmData.errorMsg) return interaction.createFollowup({ content: translateKey(dbUser.locale, "unableToGetRealmData", {error:realmData.errorMsg})});

		if(realmData.honeypot && !dbUser.didLink) sendHoneyportAlert(interaction, realmCode);

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

		const feed = await getClubFeed(accountID, realmData.clubId);

		feedCache.set(realmCode, feed);

		// after 3 minutes delete feed cache to save memory
		setTimeout(() => {
			feedCache.delete(realmCode);
		}, 180000);

		const page = args.page ?? 1;
		const lastPage = Math.ceil(feed.length / 10);

		interaction.createFollowup({
			embeds: getFeedEmbeds(feed, page),
			components: [{
				type: 1,
				components: [
					{
						type: 2,
						label: `${translateKey, "page"}: ${page}/${lastPage}`,
						style: 3,
						custom_id: "a",
						disabled: true
					},
					{
						type: 2,
						label: "<<",
						style: 1,
						custom_id: JSON.stringify({a:realmCode,b:accountID,c:"a",d:lastPage,e:1})
					},
					{
						type: 2,
						label: "<",
						style: 1,
						custom_id: JSON.stringify({a:realmCode,b:accountID,c:"b",d:lastPage,e:page - 1})
					},
					{
						type: 2,
						label: ">",
						style: 1,
						custom_id: JSON.stringify({a:realmCode,b:accountID,c:"c",d:lastPage,e:page + 1})
					},
					{
						type: 2,
						label: ">>",
						style: 1,
						custom_id: JSON.stringify({a:realmCode,b:accountID,c:"d",d:lastPage,e:lastPage})
					}
				]
			}]
		});
	},
	componentPressEvent: updateFeed
};

function getFeedEmbeds(feed, page) {
	const embeds = [];

	for(let i = (page - 1) * 10; i < 10 * page; i++) {
		const post = feed[i];
		if(!post) break;

		const title = post.ugcCaption.substring(0, 256);

		const embed = {
			title: title,
			timestamp: post.date,
			color: parseInt(post.authorInfo.color.primaryColor, 16),
			image: {
				url: post.screenshotThumbnail
			},
			author: {
				name: post.authorInfo.modernGamertag,
				icon_url: post.authorInfo.imageUrl
			},
			footer: {
				text: post.contentTitle ?? "Xbox App",
				icon_url: post.contentImageUri ?? "https://i.pinimg.com/originals/80/cf/2e/80cf2ef662cbc6024ac5198f8e3a888d.jpg"
			}
		};

		embeds.push(embed);
	}

	return embeds;
}

async function updateFeed(interaction, custom_id) {
	let { a: id, b: accountID, d: lastPage, e: newPage } = JSON.parse(custom_id);

	// backwards compatibility
	if(!id) {
		const data = JSON.parse(custom_id);

		id = data.id;
		accountID = data.accountID;
		lastPage = data.lastPage;
		newPage = data.newPage;
	}

	/** 
	 * a = full_back
	 * b = back
	 * c = forward
	 * d = full_forward
	*/
	if(newPage < 1 || newPage > lastPage) return interaction.createMessage({content: `You cannot go any ${newPage < 1 ? "more backwards" : "further"}.`, flags: 64});

	// we edit the message so if the acknowledge fails it doesnt really matter
	interaction.acknowledge();

	let feed = feedCache.get(id);
	if(!feed) {
		const { clubId } = await getRealmData(id, accountID);
		feed = await getClubFeed(accountID, clubId);

		feedCache.set(id, feed);
		// after 3 minutes delete feed cache to save memory
		setTimeout(() => {
			feedCache.delete(id);
		}, 180000);
	}

	interaction.message.edit({
		embeds: getFeedEmbeds(feed, newPage),
		components: [{
			type: 1,
			components: [
				{
					type: 2,
					label: `Page: ${newPage}/${lastPage}`,
					style: 3,
					custom_id: "a",
					disabled: true
				},
				{
					type: 2,
					label: "<<",
					style: 1,
					custom_id: JSON.stringify({a:id,b:accountID,c:"a",d:lastPage,e:1})
				},
				{
					type: 2,
					label: "<",
					style: 1,
					custom_id: JSON.stringify({a:id,b:accountID,c:"b",d:lastPage,e:newPage - 1})
				},
				{
					type: 2,
					label: ">",
					style: 1,
					custom_id: JSON.stringify({a:id,b:accountID,c:"c",d:lastPage,e:newPage + 1})
				},
				{
					type: 2,
					label: ">>",
					style: 1,
					custom_id: JSON.stringify({a:id,b:accountID,c:"d",d:lastPage,e:lastPage})
				}
			]
		}]
	});
}