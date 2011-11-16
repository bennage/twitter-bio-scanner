var ntwitter = require('ntwitter');
var fs = require('fs');

var twitter = new ntwitter({
    consumer_key: '',
    consumer_secret: '',
    access_token_key: '',
    access_token_secret: ''
});

var stop_words = '-,http,,a,able,about,across,after,all,almost,also,am,among,an,and,any,are,as,at,b,be,because,been,but,by,c,can,cannot,could,d,de,dear,did,do,does,either,e,else,ever,every,f,for,from,g,get,got,h,had,has,have,he,her,hers,him,his,how,however,i,if,in,into,is,it,its,j,just,k,l,least,let,likely,m,may,me,might,most,must,my,neither,n,no,nor,not,o,of,off,often,oh,on,only,or,other,our,own,p,q,r,rather,s,said,say,says,she,should,since,so,some,t,than,that,the,their,them,then,there,these,they,this,tis,to,too,twas,u,us,v,w,wants,was,we,were,what,when,where,which,while,who,whom,why,will,with,would,x,y,yet,you,your,z'.split(',');
var re = /([\-a-zA-Z]+(\.com|\.net|\.org)*)/ig;

// execute a set of functions in parallel 
// and return the aggregrated result
// assumes that all functions execute a callback 
function parallel(set) {
    var results = [],
        remaining = set.length;

    return function(callback) {
        set.forEach(function(f, i) {
            f(function(result) {
                results[i] = result;
                remaining--;
                if (remaining <= 0) {
                    callback(results);
                }
            });
        });
    };
}

function partition(array, size) {
    var segments = [],
        count = array.length;

    while (count > 0) {
        segments.push(array.splice(0, size));
        count -= size;
    }

    return segments;
}

function countWords(bio) {
    if (!bio) return {};

    var matches = bio.match(re);
    if (!matches) return {};

    return matches.filter(function(word) {
        return stop_words.indexOf(word.toLowerCase()) === -1;
    }).reduce(function(state, current) {
        current = current.toLowerCase();
        if (!(current in state)) {
            state[current] = 0;
        }
        state[current]++;
        return state;
    }, {});
}

function aggregate(target,source) {
    for (var property in source) {
        if (!(property in target)) {
            target[property] = 0;
        }
        target[property] += source[property];
    }
    return target;
}

function scanBios(ids) {
    return function(callback) {

        twitter.showUser(ids.join(','), function(err, users) {

            console.log('scanning batch of ids');

            var agg = users.map(function(user) {
                return countWords(user.description);
            }).reduce(aggregate, {});

            callback(agg);
        });
    };
}

twitter.getFollowersIds(function(err, followers) {

    console.log('found ' + followers.length + ' followers');

    var ops = partition(followers, 100).map(scanBios);

    parallel(ops)(function(results) {
        var data = results.reduce(aggregate,{});
        var property, count;
        var array = [];
        var out = '';

        // convert the hash to an array
        for(property in data) {
            count = data[property];
            if(count > 1) {
                array.push( { word: property, count: count });        
            }
        }

        array.sort(function(a,b){
            return b.count - a.count;
        });

        array.forEach(function(item){
            out += item.word + ': ' + item.count + '\r\n';
        });

        fs.writeFile('twitter.txt', out, function(err) {
            console.log('done');
        });
    });
});