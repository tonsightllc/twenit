/**
 * Bot Widget Loader - Twenit
 * 
 * Usage:
 * <script src="https://your-domain.com/embed/bot-loader.js" 
 *         data-org-id="your-org-id" 
 *         data-bot-id="your-bot-id" 
 *         defer></script>
 */
(function () {
    "use strict";

    // Find the current script tag to read data attributes
    var script =
        document.currentScript ||
        (function () {
            var scripts = document.getElementsByTagName("script");
            return scripts[scripts.length - 1];
        })();

    var orgId = script.getAttribute("data-org-id");
    var botId = script.getAttribute("data-bot-id");

    if (!orgId) {
        console.error("[Twenit Bot] Missing data-org-id attribute.");
        return;
    }

    // Build the embed URL
    var baseUrl = script.src.replace(/\/embed\/bot-loader\.js.*$/, "");
    var embedUrl = baseUrl + "/embed/" + orgId;
    if (botId) {
        embedUrl += "?botId=" + encodeURIComponent(botId);
    }

    // Create the iframe container
    var container = document.createElement("div");
    container.id = "twenit-bot-container";
    container.style.cssText =
        "position:fixed;bottom:0;right:0;width:420px;height:620px;z-index:99999;pointer-events:none;";

    var iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.style.cssText =
        "width:100%;height:100%;border:none;background:transparent;pointer-events:auto;";
    iframe.setAttribute("allow", "clipboard-write");
    iframe.setAttribute("title", "Twenit Bot Widget");
    iframe.setAttribute("loading", "lazy");

    container.appendChild(iframe);

    // Inject into the page
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            document.body.appendChild(container);
        });
    } else {
        document.body.appendChild(container);
    }
})();
