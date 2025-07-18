function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Basic HTML to Markdown converter
function htmlToMarkdown(html) {
    return html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~')
        .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
        .replace(/<ul[^>]*>/gi, '\n').replace(/<\/ul>/gi, '\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '') // remove any other HTML tags
        .replace(/\n{3,}/g, '\n\n') // normalize spacing
        .trim();
}

async function run() {
    const SLACK_API_FILES_INFO_ENDPOINT = "https://slack.com/api/files.info";
    const RETRY_DELAY = 5000;
    const MAX_RETRIES = 3;

    const inputConfig = input.config();
    const slackToken = inputConfig.slackapi;
    if (!slackToken) throw new Error("Missing Slack API token in input variables (expected 'slackapi').");

    const canvasTable = base.getTable("Slack Canvases");

    const existingRecordsQuery = await canvasTable.selectRecordsAsync({ fields: ["Canvas ID"] });
    const existingCanvasMap = new Map(
        existingRecordsQuery.records.map(record => [
            record.getCellValue("Canvas ID"),
            record.id
        ])
    );

    const canvasesToFetch = [
        { id: "F08CKEJSC9M", title: "Release Submissions", channelOrDM: "#release-submissions" },
        { id: "F08ENA4PHHP", title: "Fortnite Daily Canvas", channelOrDM: "#fortnite-daily" },
        { id: "F088VEFQKA7", title: "Release Operations Canvas", channelOrDM: "#release-ops" }
    ];

    async function fetchWithRetry(url, options, logContext) {
        let retries = MAX_RETRIES;
        while (retries > 0) {
            try {
                const response = await fetch(url, options);
                if (response.status === 429) {
                    const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
                    console.warn(`${logContext}: Rate limited. Retrying after ${retryAfter}s.`);
                    await wait(retryAfter * 1000);
                    retries--;
                    continue;
                }
                return response;
            } catch (err) {
                console.error(`${logContext}: Network error: ${err.message}`);
                retries--;
                if (retries === 0) throw new Error(`${logContext} failed after retries: ${err.message}`);
                await wait(RETRY_DELAY);
            }
        }
    }

    for (const canvas of canvasesToFetch) {
        let rawApiDataForAirtable = "{}";
        let canvasContent = "No content retrieved.";
        let canvasLink = "";
        let canvasTitle = canvas.title;

        try {
            console.log(`🔍 Fetching canvas info: ${canvas.title} (${canvas.id})`);

            const response = await fetchWithRetry(
                `${SLACK_API_FILES_INFO_ENDPOINT}?file=${canvas.id}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${slackToken}`
                    }
                },
                `files.info for ${canvas.id}`
            );

            const result = await response.json();
            rawApiDataForAirtable = JSON.stringify(result, null, 2);

            if (!result.ok) {
                console.error(`Slack API error: ${result.error}`);
                canvasContent = `Slack error: ${result.error}`;
                await updateAirtableRecord(canvas, canvasTitle, canvasLink, rawApiDataForAirtable, canvasContent, canvasTable, existingCanvasMap);
                continue;
            }

            const fileInfo = result.file;
            canvasTitle = fileInfo.title || canvas.title;
            canvasLink = fileInfo.permalink || "";

            try {
                const previewResp = await fetchWithRetry(fileInfo.url_private, {
                    headers: { Authorization: `Bearer ${slackToken}` }
                }, `preview fetch for ${canvas.id}`);

                if (previewResp.ok) {
                    const rawHtml = await previewResp.text();
                    canvasContent = htmlToMarkdown(rawHtml); // 🔄 Convert HTML to Markdown
                } else {
                    canvasContent = `Preview fetch failed with status ${previewResp.status}`;
                }
            } catch (err) {
                canvasContent = `Preview fetch error: ${err.message}`;
            }

        } catch (err) {
            canvasContent = `Script error: ${err.message}`;
            rawApiDataForAirtable = JSON.stringify({ error: err.message });
        }

        await updateAirtableRecord(canvas, canvasTitle, canvasLink, rawApiDataForAirtable, canvasContent, canvasTable, existingCanvasMap);
    }
}

async function updateAirtableRecord(canvas, canvasTitle, canvasLink, rawApiData, renderedContent, table, map) {
    const recordData = {
        "Canvas Title": canvasTitle,
        "Canvas ID": canvas.id,
        "Canvas Link": canvasLink,
        "Associated Channel/DM": `${canvas.channelOrDM}`,
        "Canvas Content (Raw)": String(rawApiData).substring(0, 100000),
        "Canvas Content (Rendered)": String(renderedContent).substring(0, 100000)
    };

    console.warn(`About to upsert record: ${canvas.title}`);

    try {
        const existingRecordId = map.get(canvas.id);
        if (existingRecordId) {
            await table.updateRecordAsync(existingRecordId, recordData);
            console.log(`✅ Updated: ${canvas.title}`);
        } else {
            const newRecord = await table.createRecordAsync(recordData);
            console.log(`🆕 Created: ${canvas.title}`);
            map.set(canvas.id, newRecord.id);
        }
    } catch (err) {
        console.error(`Airtable update failed for ${canvas.id}: ${err.message}`);
    }
}

async function executeWithErrorHandling() {
    try {
        await run();
        output.set('status', 'Completed successfully');
    } catch (error) {
        console.error(`Fatal error: ${error.message}`);
        output.set('status', 'Failed');
        output.set('error', error.message);
    }
}

await executeWithErrorHandling();
