package com.code972.ir;

import com.google.common.base.Charsets;
import com.google.common.base.Strings;
import com.google.common.io.Resources;
import edu.jhu.nlp.wikipedia.PageCallbackHandler;
import edu.jhu.nlp.wikipedia.WikiPage;
import edu.jhu.nlp.wikipedia.WikiXMLParser;
import edu.jhu.nlp.wikipedia.WikiXMLParserFactory;
import org.elasticsearch.action.ActionListener;
import org.elasticsearch.action.bulk.BulkRequestBuilder;
import org.elasticsearch.action.bulk.BulkResponse;
import org.elasticsearch.client.Client;
import org.elasticsearch.client.transport.TransportClient;
import org.elasticsearch.common.settings.ImmutableSettings;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.common.transport.InetSocketTransportAddress;
import org.elasticsearch.common.xcontent.XContentBuilder;
import org.elasticsearch.common.xcontent.XContentFactory;
import org.elasticsearch.indices.IndexAlreadyExistsException;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Hello world!
 *
 */
public class App 
{
    private static org.apache.log4j.Logger logger   = org.apache.log4j.Logger.getLogger(App.class);

    public static void main( String[] args ) throws Exception {
        String dumpFile = null;
        if (args.length > 0) dumpFile = args[0];
        if (dumpFile == null || dumpFile.length() == 0) {
            dumpFile = "/media/windows-share/hewiki-20140207-pages-articles.xml.bz2";
        }

        if (!new File(dumpFile).exists()) {
            System.out.println("File was not foud: " + dumpFile);
            return;
        }

        final String wikipediaIndexName = "hebrew-wikipedia-20140207";

        Settings settings = ImmutableSettings.settingsBuilder()
                .put("cluster.name", "hebrew-search")
                .put("node.name", "indexer").build();

        TransportClient transportClient = new TransportClient(settings);
        transportClient.addTransportAddress(new InetSocketTransportAddress("localhost", 9300));
        Client client = transportClient;

        client.admin().indices().preparePutTemplate("hebrew-general")
                .setSource(indexSettingsString("hebrew-*", 0, "")).execute().actionGet();

        try {
            client.admin().indices().prepareCreate(wikipediaIndexName).execute().actionGet();
        } catch (IndexAlreadyExistsException e) {
            // do nothing to allow reindexing
        }
        final WikiXMLParser parser = WikiXMLParserFactory.getSAXParser(new File(dumpFile).toURL());
        try {
            parser.setPageCallback(new PageCallback(client, wikipediaIndexName));
        } catch (Exception e) {
            //logger.error("failed to create parser", e);
            System.out.println(e);
            return;
        }

        parser.parse();
    }

    public static String indexSettingsString(String templateIndexName, int replicas, String moreSettings) throws IOException {
        String settings = Resources.toString(Resources.getResource(App.class, "indexSettings.json"), Charsets.UTF_8);
        settings = settings.replace("{TEMPLATE-INDEX-NAME}", templateIndexName);

        if (replicas == -1) {
            settings = settings.replace("\"number_of_replicas\":0", "\"auto_expand_replicas\":\"0-all\"");
        } else if (replicas > 0) {
            settings = settings.replace("\"number_of_replicas\":0", "\"number_of_replicas\":" + replicas);
        }

        settings = settings.replace(",\"more\":{}", moreSettings);

        return settings;
    }

    private static class PageCallback implements PageCallbackHandler {
        private final Client client;
        private final String indexName;
        private BulkRequestBuilder currentRequest;
        private static int bulkSize = 100;
        private static final AtomicInteger onGoingBulks = new AtomicInteger();
        private int allowedConcurrentBulks = 3;

        public PageCallback(Client client, String indexName) {
            this.client = client;
            this.indexName = indexName;
            this.currentRequest = client.prepareBulk();
        }

        @Override
        public void process(WikiPage page) {
            String title = stripTitle(page.getTitle());
            if (logger.isTraceEnabled()) {
                logger.trace(String.format("page #%s: %s", page.getID(), page.getTitle()));
            }

            if (page.isSpecialPage()) {
                //System.out.println(" - skipping " + title);
                return;
            }

            try {
                XContentBuilder builder = XContentFactory.jsonBuilder().startObject();
                builder.field("title", title);
                builder.field("text", page.getText().trim());

                if (page.isRedirect()) {
                    if (!Strings.isNullOrEmpty(page.getRedirectPage()))
                        builder.field("redirect", page.getRedirectPage());
                    else
                        builder.field("redirect", "#");
                }
                if (page.isSpecialPage())
                    builder.field("special", true);
                if (page.isStub())
                    builder.field("stub", true);
                if (page.isDisambiguationPage())
                    builder.field("disambiguation", true);

                builder.startArray("categories");
                for (String s : page.getCategories()) {
                    builder.value(s);
                }
                builder.endArray();

                builder.startArray("link");
                for (String s : page.getLinks()) {
                    builder.value(s);
                }
                builder.endArray();

                builder.endObject();
                // For now, we index (and not create) since we need to keep track of what we indexed...
                currentRequest.add(client.prepareIndex(indexName, "contentpage", page.getID()).setCreate(false).setSource(builder));
                processBulkIfNeeded(page.getID());
            } catch (Exception e) {
                logger.warn("failed to construct index request", e);
            }
        }

        int inserted = 0;
        private void processBulkIfNeeded(String id) {
            if (currentRequest.numberOfActions() >= bulkSize) {
                // execute the bulk operation
                int currentOnGoingBulks = onGoingBulks.incrementAndGet();
                if (currentOnGoingBulks > allowedConcurrentBulks) {
                    // TODO, just wait here!, we can slow down the wikipedia parsing
                    logger.warn(String.format("dropping bulk, [%d] crossed threshold [%d]", onGoingBulks.get(), allowedConcurrentBulks));

                    try {
                        Thread.sleep(6000);
                    } catch (InterruptedException e) {
                        Thread.interrupted();
                    }
                }

                try {
                    currentRequest.execute(new ActionListener<BulkResponse>() {
                        @Override
                        public void onResponse(BulkResponse bulkResponse) {
                            onGoingBulks.decrementAndGet();
                            if (bulkResponse.hasFailures()) {
                                logger.warn("Bulk response has failures");
                            }
                        }

                        @Override
                        public void onFailure(Throwable e) {
                            logger.warn("failed to execute bulk");
                        }
                    });
                } catch (Exception e) {
                    logger.warn("failed to process bulk", e);
                    return;
                }

                inserted += currentRequest.numberOfActions();
                System.out.println("Inserted " + inserted + " last id " + id);

                currentRequest = client.prepareBulk();
            }
        }

        private StringBuilder sb = new StringBuilder();

        private String stripTitle(String title) {
            sb.setLength(0);
            sb.append(title);
            while (sb.length() > 0 && (sb.charAt(sb.length() - 1) == '\n' || (sb.charAt(sb.length() - 1) == ' '))) {
                sb.deleteCharAt(sb.length() - 1);
            }
            return sb.toString();
        }
    }

}
