// ==UserScript==
// @name         Reddit Content on Hover
// @namespace    https://github.com/dracool/rContentOnHover
// @version      1.0
// @description  Adds in-page popup display of (some) posts content when hovering over the title
// @author       NeXtDracool
// @downloadURL  https://github.com/dracool/rContentOnHover/blob/master/rcoh.js
// @include      /https*:\/\/\w+\.reddit\.com\/r\/[^\/]+(?:\/(?:\?.*)*)*$/
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.1.0.min.js
// ==/UserScript==

(function(){
  "use strict";

  //Add Cross Origin support to jquery
  (function($, dataType, undefined){
    //transport function to be used by jquery
    var xssTransport =  function(_jQueryObj, dataType){
      return (function(options, originalOptions, jqXHR){
        if(GM_xmlhttpRequest !== undefined){
          var extend = (_jQueryObj || $).extend,
              mergedOptions = extend(true, {}, options, originalOptions),
              // Translate jQuery jqXHR options to GM options (there are some subtle differences)
              optionMap = {
                context: 'context',
                overrideMimeType: 'overrideMimeType',
                timeout: 'timeout',
                username: 'user', // "username" is "user " when using GM_xmlhttpRequest
                password: 'password',
                onreadystatechange: 'onreadystatechange', // GM Specific option
                ontimeout: 'ontimeout', // GM Specific option
                onprogress: 'onprogress', // GM Specific option
                binary: 'binary' // GM Specific option
              };
          return {
            send: function(headers, callback){
              var origType = (originalOptions.dataType || '').toLowerCase(),
                  gm_request_options = {
                    method: options.type || "GET",
                    url: options.url,
                    // Shallow clone of data from both options
                    data: extend({}, options.data || {}, originalOptions.data || {}),
                    headers: headers,
                    onload: function(response){
                      // Done response
                      var dResponse = {text: response.responseText},
                          rContentType = '',
                          key;
                      try{
                        // Try to extract the content type from the response headers
                        rContentType = (/Content-Type:\s*([^\s]+)/i.exec(response.responseHeaders))[1];
                      }catch(e){}
                      // HTML
                      if(origType === 'html' || /text\/html/i.test(rContentType)) {
                        dResponse.html = response.responseText;

                        // JSON
                      } else if(origType === 'json' || (origType !== 'text' && /\/json/i.test(rContentType))){
                        try{
                          dResponse.json = $.parseJSON(response.responseText);
                        }catch(e){}
                        // XML
                      } else if(origType == 'xml' || (origType !== 'text' && /\/xml/i.test(rContentType))){
                        if(response.responseXML){
                          // Use XML response if it exists
                          dResponse.xml = response.responseXML;
                        } else {
                          // Use DOM parser if it doesn't exist
                          try{dResponse.xml = new DOMParser().parseFromString(response.responseText, "text/xml");}catch(e){}
                        }
                      }
                      callback(200, "success", dResponse, response.responseHeaders);
                    },
                    onerror: function(response){
                      callback(404, "error", {text: response.responseText}, response.responseHeaders);
                    }
                  };
              // Map options
              for(var key in optionMap){
                if(PROPDEFINED(mergedOptions,key)){
                  gm_request_options[optionMap[key]] = mergedOptions[key];
                }
              }
              // If async option if false, enable synchronous option
              if(mergedOptions.async === false)
                gm_request_options.synchronous = true;
              // Send request
              GM_xmlhttpRequest(gm_request_options);
            },
            abort: function() {
              // No abort support
            }
          };
        }
      });
    };
    //don't add without GM support
    if(undefined === typeof GM_xmlhttpRequest || !$)
      return;
    //don't enable twice
    if($.next_css)
      return;
    $.ajaxTransport(
      dataType || "* text html xml json",
      xssTransport($, dataType)
    );
    $.extend({next_xss: true});
  })($);

  function manipulateDomForUrl(url, container) {
    var map = [
      //reddit links are not prefixed with a domain and start with a /
      {k: "/", v: function(u,c) {
        return $.get(u)
          .done(function(data) {
          c.css({
            background: "#fafafa"
          })
            .addClass("md-container usertext-body");
          let item = $("<div/>").html(data);
          item = item.find("#siteTable");
          let temp = $(item).find("div.usertext-body > div");
          if(temp.length > 0) {
            temp.css("border", "none");
            temp.appendTo(c);
            return;
          }
          temp = $(item).find("div.media-preview-content img.preview");
          if(temp.length > 0) {
            c.css("padding", "0");
            temp.css({
              display: "block",
              width: "auto",
              height: "auto",
              "max-height": "296px"
            });
            temp.appendTo(c);
            return;
          }
        });
      }},
      //all basic image types are simply displayed in an img tag
      {k: /.+\.(?:png|jpg|gif)$/, v: function(u,c){
        c.css("padding", "0");
        let item = $("<img></img>").css({
          display: "block",
          width: "auto",
          height: "auto",
          "max-height": "296px"
        })
        .attr("src", u);
        item.appendTo(c);
        return true;
      }}
    ];

    let promise = null;
    for(let el of map) {
      if(typeof el.k === "string") {
        if(url.startsWith(el.k)) {
          promise = el.v(url, container);
          break;
        }
      } else if(el.k.constructor == RegExp) {
        if(url.match(el.k)) {
          promise = el.v(url, container);
          break;
        }
      }
      else {
        promise = false;
      }
    }

    if(promise) {
      let finish = function() {
        container.find("span.rContentOnHoverLoading").remove();
      };
      if(promise === true) {
        finish();
      } else {
        promise.done(finish);
        promise.fail(function(xhr, textStatus, errorThrown) {
          //TODO: handle error properly, for now just swallow error
        });
      }
    }

    return promise;
  }

  var loaded = {};

  function createTTContainer() {
    return $("<div/>").css({
      position: "absolute",
      padding: "5px",
      float: "left",
      background: "#ededed",
      color: "black",
      border: "2px solid black",
      "max-height": "300px",
      "border-radius": "10px",
      "margin-top": "10px",
      "z-index": "5",
      "overflow-y": "hidden"
    }).html('<span class="rContentOnHoverLoading">Loading...</span>').hide();
  }

  function onHoverStart(event) {
    let url = $(event.target).attr("href");
    if(loaded[url]){
      $(loaded[url].dom).fadeIn();
      clearTimeout(loaded[url].to);
      loaded[url].to = null;
    } else {
      loaded[url] = {};
      let domEl = createTTContainer().insertAfter(event.target);
      let res = manipulateDomForUrl(url, domEl);
      if(res) {
        domEl.fadeIn();
        loaded[url].dom = domEl;
      } else {
        if(res !== null) {
          domEl.remove();
        }
      }
    }
  }

  function onHoverEnd(event) {
    //return; //DEBUG ONLY: let's me use the inspector on tooltip dom
    let url = $(event.target).attr("href");
    if(loaded[url]) {
      $(loaded[url].dom).fadeOut();
      loaded[url].to = setTimeout(function() {
        if(!loaded[url] || !loaded[url].dom) return;
        $(loaded[url].dom).remove();
        loaded[url] = undefined;
      }, 20000);
    }
  }

  $(document).ready(function(){
    //DEBUGGING ONLY: get rid of reddits pesky error handling
    window.onerror = undefined;
    $("div.thing").find("a.title, a.thumbnail").hover(onHoverStart, onHoverEnd);
  });

}());
