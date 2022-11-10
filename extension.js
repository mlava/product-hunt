const createBlock = (params) => {
    const uid = window.roamAlphaAPI.util.generateUID();
    return Promise.all([
        window.roamAlphaAPI.createBlock({
            location: {
                "parent-uid": params.parentUid,
                order: params.order,
            },
            block: {
                uid,
                string: params.node.text
            }
        })
    ].concat((params.node.children || []).map((node, order) =>
        createBlock({ parentUid: uid, order, node })
    )))
};

var PHHeader;
var CP = true;

export default {
    onload: ({ extensionAPI }) => {
        const config = {
            tabTitle: "Product Hunt",
            settings: [
                {
                    id: "ph-api",
                    name: "API Key",
                    description: "Product Hunt API token",
                    action: { type: "input", placeholder: "Add API key here" },
                },
                {
                    id: "ph-number",
                    name: "Number to import",
                    description: "Action to take on swipe right",
                    action: { type: "input", placeholder: "5" },
                },
                {
                    id: "ph-header",
                    name: "Header text",
                    description: "Heading under which to place imported items",
                    action: { type: "input", placeholder: "Product Hunt Top Voted:" },
                },
                {
                    id: "ph-thumbnail",
                    name: "Show Thumbnail",
                    description: "Switch on to show thumbnail",
                    action: { type: "switch" },
                },
            ]
        };
        extensionAPI.settings.panel.create(config);

        window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: "Product Hunt import",
            callback: () => {
                const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
                if (uid == undefined) {
                    alert("Please make sure to focus a block before importing from Product Hunt");
                    return;
                }
                fetchPH(CP).then(async (blocks) => {
                    const parentUid = uid || await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
                    await window.roamAlphaAPI.updateBlock(
                        { block: { uid: parentUid, string: PHHeader.toString(), open: true } });
                    blocks.forEach((node, order) => createBlock({
                        parentUid,
                        order,
                        node
                    }))
                });
            },
        });

        const args = {
            text: "PRODUCTHUNT",
            help: "Import top products from Product Hunt",
            handler: (context) => fetchPH,
        };

        if (window.roamjs?.extension?.smartblocks) {
            window.roamjs.extension.smartblocks.registerCommand(args);
        } else {
            document.body.addEventListener(
                `roamjs:smartblocks:loaded`,
                () =>
                    window.roamjs?.extension.smartblocks &&
                    window.roamjs.extension.smartblocks.registerCommand(args)
            );
        }

        async function fetchPH(CP) {
            var key, numberProducts;
            breakme: {
                if (!extensionAPI.settings.get("ph-api")) {
                    key = "API";
                    sendConfigAlert(key);
                    break breakme;
                } else {
                    const apiKey = extensionAPI.settings.get("ph-api");
                    if (!extensionAPI.settings.get("ph-number")) {
                        numberProducts = "5";
                    } else {
                        const regex = /^[0-9]{1,2}$/m;
                        if (regex.test(extensionAPI.settings.get("ph-number"))) {
                            numberProducts = extensionAPI.settings.get("ph-number");
                        } else {
                            key = "num";
                            sendConfigAlert(key);
                            break breakme;
                        }
                    }
                    if (!extensionAPI.settings.get("ph-header")) {
                        PHHeader = "Product Hunt Top Voted:";
                    } else {
                        PHHeader = extensionAPI.settings.get("ph-header");
                    }

                    var currentDate = new Date();
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth() + 1;
                    const date = currentDate.getDate() - 1;
                    var url = "https://api.producthunt.com/v1/posts/all?sort_by=votes_count&order=desc&search[featured_day]=" + date + "&search[featured_month]=" + month + "&search[featured_year]=" + year + "";

                    var myHeaders = new Headers();
                    var bearer = 'Bearer ' + apiKey;
                    myHeaders.append("Authorization", bearer);
                    var requestOptions = {
                        method: 'GET',
                        headers: myHeaders,
                        redirect: 'follow'
                    };

                    const response = await fetch(url, requestOptions);
                    var data = await response.json();

                    let output = [];
                    
                    for (var i = 0; i < numberProducts; i++) {
                        let thisExtras = [];
                        var PHurl = data.posts[i].discussion_url.split("?");
                        var titleString = "[" + data.posts[i].name.toString() + "](" + PHurl[0] + ") #rm-hide #rm-horizontal";
                        var desc = data.posts[i].tagline;
                        thisExtras.push({ "text": desc.toString() });
                        var stringTags = "Tagged as: ";
                        for (var n = 0; n < data.posts[i].topics.length - 1; n++) {
                            stringTags += "" + data.posts[i].topics[n].name + ", ";
                        }
                        var m = data.posts[i].topics.length - 1;
                        stringTags += "" + data.posts[i].topics[m].name + "";
                        thisExtras.push({ "text": stringTags.toString() });
                        if (extensionAPI.settings.get("ph-thumbnail")) {
                            var imageString = "![" + data.posts[i].name + "](" + data.posts[i].thumbnail.image_url + ")";
                            thisExtras.push({ "text": imageString.toString() });
                        }
                        output.push({ "text": titleString, "children": thisExtras });
                    }
                    
                    if (CP == undefined) {
                        let SBoutput = [];
                        SBoutput.push({ "text": PHHeader, "children": output });
                        return SBoutput;
                    } else {
                        return output;
                    }
                };
            }
        }
    },
    onunload: () => {
        window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: 'Product Hunt import'
        });
        if (window.roamjs?.extension?.smartblocks) {
            window.roamjs.extension.smartblocks.unregisterCommand("PRODUCTHUNT");
        }
    }
}

function sendConfigAlert(key) {
    if (key == "API") {
        alert("Please enter your API key in the configuration settings via the Roam Depot tab.");
    } else if (key == "num") {
        alert("Please enter the number of items to import in the configuration settings via the Roam Depot tab.");
    }
}