function postNoun() {
    var word = document.getElementById('noun').value;
    var postReq = new XMLHttpRequest();
    var url = '/api/corpse/noun';
    postReq.open('POST', url, true);
    postReq.onload = function(event) {
        document.getElementById('noun').value = '';
    }
    postReq.setRequestHeader('Content-Type', 'text/plain');
    postReq.send(word);
}

function postAdjective() {
    var word = document.getElementById('adjective').value;
    var postReq = new XMLHttpRequest();
    var url = '/api/corpse/adjective';
    postReq.open('POST', url, true);
    postReq.onload = function(event) {
        document.getElementById('adjective').value = '';
    }
    postReq.setRequestHeader('Content-Type', 'text/plain');
    postReq.send(word);
}

function postVerb() {
    var word = document.getElementById('verb').value;
    var postReq = new XMLHttpRequest();
    var url = '/api/corpse/verb';
    postReq.open('POST', url, true);
    postReq.onload = function(event) {
        document.getElementById('verb').value = '';
    }
    postReq.setRequestHeader('Content-Type', 'text/plain');
    postReq.send(word);
}

function postAdverb() {
    var word = document.getElementById('adverb').value;
    var postReq = new XMLHttpRequest();
    var url = '/api/corpse/adverb';
    postReq.open('POST', url, true);
    postReq.onload = function(event) {
        document.getElementById('adverb').value = '';
    }
    postReq.setRequestHeader('Content-Type', 'text/plain');
    postReq.send(word);
}
