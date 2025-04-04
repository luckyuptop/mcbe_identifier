import puppeteer, { Browser, Page } from "puppeteer-core";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
const assert = require("assert")

type Selector = string

type WikiContent = {
    name: string,
    button?: Selector,
    content: Selector
}

type WikiPage = {
    lang: string,
    url: string,
    content: WikiContent[]
}

const ZH_WIKI_CONTENT: WikiContent[] = [
    {
        name: "entity",
        button: '#mw-content-text > div.mw-parser-output > div:nth-child(11) > h3 > span.mw-editsection-like.load-page-button > span',
        content: '#mw-content-text > div.mw-parser-output > div:nth-child(11) > div.load-page-content > div.mw-parser-output'
    },
    {
        name: "item",
        button: '#mw-content-text > div.mw-parser-output > div:nth-child(7) > h3 > span.mw-editsection-like.load-page-button > span',
        content: '#mw-content-text > div.mw-parser-output > div:nth-child(7) > div.load-page-content > div.mw-parser-output'
    },
    {
        name: "block",
        button: '#mw-content-text > div.mw-parser-output > div:nth-child(6) > h3 > span.mw-editsection-like.load-page-button > span',
        content: '#mw-content-text > div.mw-parser-output > div:nth-child(6) > div.load-page-content > div.mw-parser-output'
    },
]

const WIKITASK: WikiPage[] = [
    {
        lang: 'zh_CN',
        url: 'https://zh.minecraft.wiki/w/%E5%9F%BA%E5%B2%A9%E7%89%88%E6%95%B0%E6%8D%AE%E5%80%BC?variant=zh-cn',
        content: ZH_WIKI_CONTENT
    },
    {
        lang: 'zh_TW',
        url: 'https://zh.minecraft.wiki/w/%E5%9F%BA%E5%B2%A9%E7%89%88%E6%95%B0%E6%8D%AE%E5%80%BC?variant=zh-tw',
        content: ZH_WIKI_CONTENT
    },
    {
        lang: 'zh_HK',
        url: 'https://zh.minecraft.wiki/w/%E5%9F%BA%E5%B2%A9%E7%89%88%E6%95%B0%E6%8D%AE%E5%80%BC?variant=zh-hk',
        content: ZH_WIKI_CONTENT
    },
]
type dv = {
    icon?: string,
    ID: string,
    Hex?: string,
    namespace: string,
    name: string
}

function exportJson(html: string, wikiPage: WikiPage) {
    const $ = cheerio.load(html);
    let DataValue: { [key: string]: dv[] } = {}
    wikiPage.content.forEach(ct => {
        let tmp: dv[] = []
        $(ct.content + ' > table > tbody > tr').each((index, el) => {
            //const icon = $(el).children('td:nth-child(1)').find("img").attr('src')?.toString()
            $(el).find('sup').empty()
            const Dec = $(el).children('td:nth-child(2)').text().trim()
            const Hex = $(el).children('td:nth-child(3)').text().trim()
            const namespace = $(el).children('td:nth-child(4)').text().trim()
            const name = $(el).children('td:nth-child(5)').text().trim()
            if (Dec && Hex && namespace && name) {
                tmp.push({ ID: Dec, Hex, namespace, name })
            }
        })
        console.info("Get DataValue " + ct.name + " " + wikiPage.lang)
        DataValue[ct.name] = tmp
    })
    //群系
    let biome: dv[] = []
    $('#mw-content-text > div.mw-parser-output > table:nth-child(14) > tbody >tr').each((index, el) => {
        $(el).find('sup').empty()
        const Dec = $(el).children('td:nth-child(3)').text().trim()
        const namespace = $(el).children('td:nth-child(2)').text().trim()
        const name = $(el).children('td:nth-child(1)').text().trim()

        biome.push({ ID: Dec, namespace, name })

    })
    console.info("Get DataValue biome " + wikiPage.lang)
    DataValue["biome"] = biome
    //状态效果
    let effect: dv[] = []
    $('#mw-content-text > div.mw-parser-output > table:nth-child(17) > tbody >tr').each((index, el) => {
        const Dec = $(el).children('td:nth-child(2)').text().trim()
        const namespace = $(el).children('td:nth-child(3)').text().trim()
        const name = $(el).children('td:nth-child(1)').text().trim()

        effect.push({ ID: Dec, namespace, name })
    })
    console.info("Get DataValue effect " + wikiPage.lang)
    DataValue["effect"] = effect
    //附魔ID
    let enchant: dv[] = []
    $('#mw-content-text > div.mw-parser-output > table:nth-child(19) > tbody >tr').each((index, el) => {
        const Dec = $(el).children('td:nth-child(3)').text().trim()
        const namespace = $(el).children('td:nth-child(2)').text().trim()
        const name = $(el).children('td:nth-child(1)').text().trim()

        enchant.push({ ID: Dec, namespace, name })
    })
    console.info("Get DataValue enchant " + wikiPage.lang)
    DataValue["enchant"] = enchant
    try {
        const PATH = path.join(__dirname, `../BEDataValue/`)
        if (!fs.existsSync(PATH)) {
            fs.mkdirSync(PATH, { recursive: true })
        }
        fs.writeFileSync(path.join(__dirname, `../BEDataValue/${wikiPage.lang}.json`), JSON.stringify(DataValue,null,4))
    } catch (err) {
        console.error(err);
    }
    return DataValue
}
async function getResourceTree(page: Page) {
    let cdp = await page.createCDPSession()
    cdp.send('Page.enable');
    let resource = await cdp.send('Page.getResourceTree')
    return resource.frameTree;
}

async function getResourceContent(page: Page, id: string, url: string) {
    let cdp = await page.createCDPSession()
    try {
        cdp.send('Page.enable');
        const { content, base64Encoded } = await cdp.send(
            'Page.getResourceContent',
            { frameId: id, url },
        );
        assert.equal(base64Encoded, true);
        return content;
    } catch (err) {
        console.info(err)
    }
};

async function downloadImage(page: Page, id: string, data: dv, type: string) {

    if (!data.icon) return
    const url = "https://zh.minecraft.wiki" + data.icon
    const content = await getResourceContent(page, id, url);
    if (!content) return;
    const fileType = data.icon.match(/\.[a-z]+\?/)?.toString().replace("?", "")
    let PATH = path.join(__dirname, `../BEDataValue/images/${type}`)
    const filePath = path.join(__dirname, `../BEDataValue/images/${type}/${data.namespace}${fileType}`)
    try {
        if (!fs.existsSync(PATH)) {
            fs.mkdirSync(PATH, { recursive: true })
        }
        fs.writeFileSync(filePath, Buffer.from(content, 'base64'), 'base64');
        console.info(filePath + "保存成功")
    } catch (err) {
        console.error(err);
    }
}

async function* getPage(browser: Browser): AsyncGenerator<{ html: string, wikiPage: WikiPage }> {
    for (let i = 0; i < WIKITASK.length; i++) {
        let wikiPage = WIKITASK[i]
        const page = await browser.newPage();
        console.info("Waiting Page " + wikiPage.lang)
        await page.goto(wikiPage.url);
        console.info("Goto Page " + wikiPage.lang)
        await Promise.all(wikiPage.content.map(async ct => {
            const button = ct.button
            if (button) {
                const span = await page.$(button)
                await span?.click();
                console.info("Click " + wikiPage.lang + " " + ct.name)
            }
        }))
        await Promise.all(wikiPage.content.map(async ct => {
            await page.waitForSelector(ct.content)
            console.info("Get Content " + wikiPage.lang + " " + ct.name)
        }))
        const html = await page.content();
        await page.close()
        console.info("Page Close " + wikiPage.lang)
        yield { html, wikiPage }
    }
}

async function main() {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH
    });

    for await (let { html, wikiPage } of getPage(browser)) {
        console.info("Get Html " + wikiPage.lang)
        exportJson(html, wikiPage)
    }

    await browser.close();
    return;
}
async function img() {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH
    });
    let wikiPage = WIKITASK[0]
    const page = await browser.newPage();
    console.info("Waiting Page " + wikiPage.lang)
    await page.goto(wikiPage.url);
    console.info("Goto Page " + wikiPage.lang)
    await Promise.all(wikiPage.content.map(async ct => {
        const button = ct.button
        if (button) {
            const span = await page.$(button)
            await span?.click();
            console.info("Click " + wikiPage.lang + " " + ct.name)
        }
    }))
    await Promise.all(wikiPage.content.map(async ct => {
        await page.waitForSelector(ct.content)
        console.info("Get Content " + wikiPage.lang + " " + ct.name)
    }))
    const html = await page.content();
    const $ = cheerio.load(html);
    let DataValue: { [key: string]: dv[] } = {}
    wikiPage.content.forEach(ct => {
        let tmp: dv[] = []
        $(ct.content + ' > table > tbody > tr').each((index, el) => {
            const icon = $(el).children('td:nth-child(1)').find("img").attr('src')?.toString()
            $(el).find('sup').empty()
            const Dec = $(el).children('td:nth-child(2)').text().trim()
            const Hex = $(el).children('td:nth-child(3)').text().trim()
            const namespace = $(el).children('td:nth-child(4)').text().trim()
            const name = $(el).children('td:nth-child(5)').text().trim()
            if (Dec && Hex && namespace && name) {
                tmp.push({ ID: Dec, Hex, namespace, name, icon })
            }
        })
        console.info("Get DataValue " + ct.name + " " + wikiPage.lang)
        DataValue[ct.name] = tmp
    })
    // scrollToBottom(page);
    await page.evaluate(() => {
        return new Promise<void>(resolve => {
            let totalHeight = 0
            const distance = 100
            // 每200毫秒让页面下滑100像素的距离
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight
                window.scrollBy(0, distance)
                totalHeight += distance
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer)
                    resolve()
                }
            }, 200)
        })
    })
    let resTree = await getResourceTree(page)
    let { id } = resTree.frame
    console.info(id)
    let { block, item, entity } = DataValue
    for (let dv of block) {
        await downloadImage(page, id, dv, 'block')
    }
    for (let dv of item) {
        await downloadImage(page, id, dv, 'item')
    }
    for (let dv of entity) {
        await downloadImage(page, id, dv, 'entity')
    }
    await browser.close();
    return;
}
(async () => {
    await main()
    await img()
})()
