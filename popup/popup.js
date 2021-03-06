var $ = (function() {
  var cache = [];
  return function(id) {
    if (cache[id]) {
      return cache[id];
    }
    cache[id] = document.getElementById(id);
    return cache[id];
  }
})();
var html = (function() {
  // List of all used elements
  var li = document.createElement("li");

  function addContent(elem, txt) {
    if (txt) {
      elem.textContent = txt;
    }
    return elem;
  }
  return function(tag, txt) {
    var tmp;
    switch (tag) {
    case "li":
      tmp = li.cloneNode(false);
      break;
    default:
      tmp = document.createElement(tag);
    }
    return addContent(tmp, txt);
  }
})();

window.addEventListener("click", function (e) {
  var url = e.target.href;
  if (url) {
    chrome.extension.getBackgroundPage().open(url);
  }
});
        
var unreadObjs;
var selectedAccount, doNext = false,
    doPrevious = false;

/** Listeners **/
var Listen = function(id, on, callback, pointer) {
  var elem = $(id);
  elem.addEventListener(on, function(e) {
    if (elem.getAttribute("disabled") == "true") {
      return;
    }
    if (callback) callback.apply(pointer, [e]);
  }, false);
}

/** objects **/
var accountSelector, stat, body;
window.addEventListener("load", function () {
  accountSelector = (function() {
    var tmp = $("account_selector").getElementsByTagName("span")[0];
    return {
      get text() {
        return tmp.textContent;
      },
      set text(val) {
        tmp.textContent = val;
      }
    }
  })();
  stat = (function() {
    var list = $("stat").getElementsByTagName("b");
    return {
      get current() {
        return list[0].textContent;
      }, 
      set current(val) {
        list[0].textContent = val;
      },
      get total() {
        return list[1].textContent;
      },
      set total(val) {
        list[1].textContent = val;
      }
    }
  })();
  body = (function() {
    var content = $("email_body"),
        date = $("date"),
        email = $("email"),
        name = $("name"),
        title = $("title");
    return {
      get content() {
        return content.textContent
      },
      set content(val) {
        content.textContent = val;
      },
      get date() {
        return date.textContent
      },
      set date(val) {
        date.textContent = val;
      },
      get email() {
        return email.textContent
      },
      set email(val) {
        email.textContent = val;
      },
      get name() {
        return name.textContent
      },
      set name(val) {
        name.textContent = val;
      },
      set nameLink(val) {
        name.setAttribute("href", val)
      }, get title() {
        return title.textContent;
      },
      set title(val) {
        title.textContent = val  || "(no subject)";
      },
      set titleLink(val) {
        title.setAttribute("href", val)
      }
    }
  })();
  
  new Listen("account_selector", "click", function(e) {
    // Clear old list
    while ($("accounts").firstChild) {
      $("accounts").removeChild($("accounts").firstChild);
    }
    // Add new items
    unreadObjs.forEach(function(obj) {
      var li = html("li", obj.account);
      if (selectedAccount && obj.account == selectedAccount) {
        li.classList.add("selected");
      }
      $("accounts").appendChild(li);
    });
    e.stopPropagation();
    // Show menu
    $("accounts").style.display = "block";
    e.stopPropagation();

    function tmp(e) {
      $("accounts").style.display = "none";
      window.removeEventListener("click", tmp);
    }
    window.addEventListener("click", tmp, false);
  });
  new Listen("accounts", "click", function(e) {
    selectedAccount = e.target.textContent;
    //unselect the selected
    var li = $("accounts").firstChild;
    while (li) {
      li.classList.remove("selected");
      li = li.nextElementSibling;
    }
    e.target.classList.add("selected");
    update();
  });
  new Listen("next", "click", function(e) {
    doNext = true;
    update();
  });
  new Listen("previous", "click", function(e) {
    doPrevious = true;
    update();
  });
  new Listen("archive", "click", function(e) {
    $("archive").setAttribute("wait", true);
    $("archive").setAttribute("disabled", true);
    var link = unreadObjs[iIndex].entries[jIndex].link;
    chrome.extension.sendMessage(null, {cmd: "rc_%5Ei", link: link}, response);
  });
  new Listen("trash", "click", function(e) {
    $("trash").setAttribute("wait", true);
    $("trash").setAttribute("disabled", true);
    var link = unreadObjs[iIndex].entries[jIndex].link;
    chrome.extension.sendMessage(null, {cmd: "tr", link: link}, response);
  });
  new Listen("spam", "click", function(e) {
    $("spam").setAttribute("wait", true);
    $("spam").setAttribute("disabled", true);
    var link = unreadObjs[iIndex].entries[jIndex].link;
    chrome.extension.sendMessage(null, {cmd: "sp", link: link}, response);
  });
  new Listen("read", "click", function(e) {
    $("read").textContent = "Wait...";
    $("read").setAttribute("disabled", true);
    var link = unreadObjs[iIndex].entries[jIndex].link;
    chrome.extension.sendMessage(null, {cmd: "rd", link: link}, response);
  });
  new Listen("inbox", "click", function(e) {
    chrome.extension.getBackgroundPage().open(unreadObjs[iIndex].link);
  });
  new Listen("read-all", "click", function(e) {
    $("read-all").setAttribute("wait", true);
    $("read-all").setAttribute("disabled", true);
    var links = [];
    unreadObjs[iIndex].entries.forEach(function (entry) {
      links.push(entry.link);
    });
    chrome.extension.sendMessage(null, {cmd: "rd-all", link: links}, response);
  });
  new Listen("refresh", "click", function(e) {
    chrome.extension.getBackgroundPage().tm.reset(true);
  });
  new Listen("expand", "click", function () {
    var type = $("content").getAttribute("type");
    resize(type ? 0 : 1);
  });
});

/** Update UI if necessary **/
var iIndex, jIndex;
var update = (function() {
  var _selectedAccount, _tag = [];
  return function() {
    // Is update required?
    for (var i = unreadObjs.length - 1; i >= 0; i -= 1) {
      iIndex = i;
      var obj = unreadObjs[i];
      if (obj.account == selectedAccount && obj.count) {
        break;
      }
    }
    var obj = unreadObjs[iIndex];
    // Update accoutSelector
    var doAccountSelector = !_selectedAccount || _selectedAccount != selectedAccount;
    if (doAccountSelector) {
      if (!selectedAccount) {
        selectedAccount = obj.account;
      }
      _selectedAccount = selectedAccount;
      accountSelector.text = selectedAccount;
    }
    // Update email's body
    function updateBody(entry, index) {
      var base = /[^\?]*/.exec(entry.link)[0];
      var id = /message_id\=([^\&]*)/.exec(entry.link);
      
      stat.current = index + 1;
      body.title = entry.title;
      body.titleLink = (id.length == 2 && id[1]) ? base + "/?shva=1#inbox/" + id[1] : entry.link;
      body.name = entry.author_name;
      body.nameLink = base + "?view=cm&fs=1&tf=1&to=" + entry.author_email;
      body.email = "<" + entry.author_email + ">";
      body.date = prettyDate(entry.modified);
      updateContent ();
      _tag[selectedAccount] = entry.id;
    }
    var doBody = !_tag[selectedAccount] || doAccountSelector || doNext || doPrevious;
    // Make sure selected item is still available
    if (!doBody) {
      var isAvailable = false;
      obj.entries.forEach(function(entry, index) {
        if (entry.id == _tag[selectedAccount]) {
          isAvailable = true;
          // Tag is available but its index is wrong due to recent update,
          // So switch to the first index (newest one)
          if (index != parseInt(stat.current) - 1) {
            _tag[selectedAccount] = null;
            doBody = true;
          }
          // Old entry, just update time
          else {
            body.date = prettyDate(entry.modified);
          }
        }
      });
      if (!isAvailable) {
        doBody = true;
        if (jIndex && obj.entries[jIndex - 1]) {
          _tag[selectedAccount] = obj.entries[jIndex - 1].id;
        } 
        else {
          _tag[selectedAccount] = null;
        }
      }
    }
    if (doBody) {
      if (!_tag[selectedAccount]) {
        _tag[selectedAccount] = obj.entries[0].id;
      }
      var detected = false;
      for (var j = obj.entries.length - 1; j >= 0; j -= 1) {
        var entry = obj.entries[j];
        if (entry.id == _tag[selectedAccount]) {
          detected = true;
          if (doNext) {
            jIndex = j + 1;
            doNext = false;
          }
          else if (doPrevious) {
            doPrevious = false;
            jIndex = j - 1;
            updateBody(obj.entries[jIndex], jIndex);
          }
          else {
            jIndex = j;
          }
          updateBody(obj.entries[jIndex], jIndex);
          break;
        }
      }
      // In case, email thread is not detected, switch to the first email
      if (!detected) {
        jIndex = 0;
        updateBody(obj.entries[jIndex], jIndex);
      }
    }
    // Update toolbar buttons
    var pr = false,
        nt = false;
    if (jIndex == 0) {
      pr = true;
    }
    if (jIndex == obj.count - 1 || jIndex == 19) {
      nt = true;
    }
    if (obj.count == 1) {
      pr = true;
      nt = true;
    }
    if (pr) {
      $("previous").setAttribute("disabled", true);
    }
    else {
      $("previous").removeAttribute("disabled");
    }
    if (nt) {
      $("next").setAttribute("disabled", true);
    }
    else {
      $("next").removeAttribute("disabled");
    }
    // Update stat
    stat.total = obj.count;
  }
})();

function response (cmd) {
  if (cmd == "rd") {
    $("read").textContent = "Mark as read";
    $("read").removeAttribute("disabled");
  }
  else {
    var obj;
    switch (cmd) {
    case "rd":
      obj = $("read");
      break;
    case "rd-all":
      obj = $("read-all");
      break;
    case "tr":
      obj = $("trash");
      break;
    case "rc_%5Ei":
      obj = $("archive");
      break;
    case "sp":
      obj = $("spam");
      break;
    }
    obj.removeAttribute("wait");
    obj.removeAttribute("disabled");
  }
  chrome.extension.sendMessage(null, {
    cmd: "decrease_mails", 
    iIndex: iIndex, 
    jIndex:jIndex
  });
};

var tools = {
  onCommand: function () {
    //Update
    unreadObjs = chrome.extension.getBackgroundPage().unreadObjs;
    //Is previouly selected account still available?
    if (selectedAccount) {
      var isAvailable = false;
      unreadObjs.forEach(function(obj) {
        if (obj.account == selectedAccount) {
          isAvailable = true;
        }
      });
      if (!isAvailable) {
        selectedAccount = unreadObjs[0].account;
      }
    }
    update();
  }
}
window.addEventListener("load", function () {
  tools.onCommand();
  resize(chrome.extension.getBackgroundPage().prefs.size);
}, false);

// Resize
function resize(mode) {
  mode = parseInt(mode);
  chrome.extension.getBackgroundPage().prefs.size = mode;
  width = mode ? 530 : 430;
  height = mode ? 300 : 32;
  $("email_body").style.height = height + "px";
  document.body.style.width = width + "px";

  if (mode) {
    $("header").setAttribute("type", "expanded");
    $("content").setAttribute("type", "expanded");
    $("toolbar").setAttribute("type", "expanded");
  }
  else {
    $("header").removeAttribute("type");
    $("content").removeAttribute("type");
    $("toolbar").removeAttribute("type");
  }
  updateContent();
  //Close account selection menu if it is open
  $("accounts").style.display = "none";
}

function updateContent () {
  function doSummary () {
    var summary = unreadObjs[iIndex].entries[jIndex].summary;
    $("email_body").textContent = summary + " ...";
  }
  var type = $("content").getAttribute("type");
  if (type) {
    if (typeof iIndex === 'undefined' || typeof jIndex === 'undefined') return;
    var link = unreadObjs[iIndex].entries[jIndex].link;
    var content = chrome.extension.getBackgroundPage().contentCache[link];
    if (content) {
      $("content").removeAttribute("mode");
      $("email_body").innerHTML = content;
    }
    else {
      doSummary ();
      $("content").setAttribute("mode", "loading");
      chrome.extension.getBackgroundPage().getBody(link, function (content) {
        if (link == unreadObjs[iIndex].entries[jIndex].link) {
          chrome.extension.getBackgroundPage().contentCache[link] = 
            content === "..." ?  unreadObjs[iIndex].entries[jIndex].summary + " ..." : content;
          updateContent ();
        }
      });
    }
  }
  else {
    doSummary ();
  }
}

/** misc functions **/
// JavaScript Pretty Date by John Resig (ejohn.org)
function prettyDate(time) {
  var date = new Date((time || "")),
      diff = (((new Date()).getTime() - date.getTime()) / 1000),
      day_diff = Math.floor(diff / 86400);
  if (isNaN(day_diff) || day_diff < 0) {
    return "just now";
  }
  return day_diff == 0 && (
    diff < 60 && "just now" || 
    diff < 120 && "1 minute ago" || 
    diff < 3600 && Math.floor(diff / 60) + " minutes ago" || 
    diff < 7200 && "1 hour ago" || 
    diff < 86400 && Math.floor(diff / 3600) + " hours ago") || 
    day_diff == 1 && "Yesterday" || 
    day_diff < 7 && day_diff + " days ago" || 
    day_diff && Math.ceil(day_diff / 7) + " weeks ago";
}