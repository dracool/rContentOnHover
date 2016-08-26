// ==UserScript==
// @name         Reddit Content on Hover
// @namespace    https://github.com/dracool/rContentOnHover
// @version      1.2
// @description  Adds in-page popup display of (some) posts content when hovering over the title
// @author       NeXtDracool
// @downloadURL  https://github.com/dracool/rContentOnHover/blob/master/rcoh.user.js
// @include      /https?:\/\/\w+\.reddit\.com\/r\/[^\/]+(?:\/(?:\?.*)*)*$/
// @grant        GM_xmlhttpRequest
// @require      https://code.jquery.com/jquery-3.1.0.min.js
// @connect      gfycat.com
// ==/UserScript==

(function(){
  "use strict";

  var GMRequest = {
    raw: function(options) {
      if(!options) return;
      let deferred = new $.Deferred();
      let onload = options.onload;
      let onerror = options.onerror;
      options.onload = function(response) {
        if(onload) onload(response);
        deferred.resolve(response);
      };
      options.onerror = function(response) {
        if(onerror) onerror(response);
        deferred.reject(response);
      };
      GM_xmlhttpRequest(options);
      return deferred.promise();
    },
    get: function(url, options) {
      if(!options) {
        options = {};
      }
      if(typeof url === "object") {
        options = url;
      } else {
        options.url = url;
      }
      options.method = "GET";
      return GMRequest.raw(options);
    }
  };

  function manipulateDomForUrl(url, container) {
    var map = [
      //reddit links are not prefixed with a domain and start with a /
      //also handles media preview images
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
      //basic image types are simply displayed in an img tag
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
      }},
      //gfycat support for embedd video playback
      {k: /https?:\/\/gfycat\.com\/*/, v: function(u,c) {
        //use special cross-origion get request to deal with gfycats origin access restriction
        return GMRequest.get(u,{
          headers: {
            origin: "gfycat.com",
            referer: "gfycat.com"
        }}).done(function(d){
          let item = $("<div/>").html(d.responseText);
          item = item.find("video");
          item.css({
            display: "block",
            width: "auto",
            height: "auto",
            "max-height": "296px"
          });
          c.css("padding", "0");
          item.appendTo(c);
        });
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
    //window.onerror = undefined;
    $("div.thing").find("a.title, a.thumbnail").hover(onHoverStart, onHoverEnd);
  });

}());
