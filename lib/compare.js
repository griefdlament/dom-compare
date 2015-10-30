(function(){

   "use strict";

   var type = require('./node_types');
   var Collector = require('./collector');
   var fs = require('fs');
   var attributeExclude = [], ignoreChildNodeDetail = [];

   function Comparator(options, collector, attribute, ignore) {
      this._options = options || {};
      if(!collector)
         throw new Error("Collector instance must be specified");
      this._collector = collector;

      if(attribute)
        this._loadExcludeConfigFile(attribute, attributeExclude);
      if(ignore)
        this._loadExcludeConfigFile(ignore, ignoreChildNodeDetail);
   }

   // mock function for load config file
   Comparator.prototype._loadExcludeConfigFile = function(path, list) {
     fs.readFileSync(path).toString().split("\n").forEach(function(line, index, arr) {
       if(line != "")
         list.push(line.trim())
     })
   };

   Comparator.prototype._filterNodes = function(list) {
      var ret = [],
         i, l, item;
      for (i = 0, l = list.length; i < l; i++) {
         item = list.item(i);
         if (item.nodeType == type.COMMENT_NODE && !this._options.compareComments)
            continue;
         if (item.nodeType == type.TEXT_NODE) // && ("" + item.nodeValue).trim() == "")
            continue;
         ret.push(item);
      }
      return ret;
   };

   Comparator.prototype._compareNodeList = function(left, right) {
      var lLeft = this._filterNodes(left),
         lRight = this._filterNodes(right),
         i, l, flag = true;

      for (i = 0, l = Math.max(lLeft.length, lRight.length); i < l; i++) {
         if(lLeft[i] && lRight[i]) {
            if (!this.compareNode(lLeft[i], lRight[i]))
               flag = false;
         }
         else {
            flag = this._collector.collectFailure(lLeft[i], lRight[i]);
         }
      }
      return flag;
   };

   Comparator.prototype._compareAttributes = function(expected, actual) {
      var aExpected = {}, aActual = {},
         i, l, flag = true;

      if (!expected && !actual)
         return true;

      for(i = 0, l = expected.length; i < l; i++) {
         aExpected[expected[i].nodeName] = expected[i];
      }

      for(i = 0, l = actual.length; i < l; i++) {
         aActual[actual[i].nodeName] = actual[i];
      }

      for(i in aExpected) {
         // both nodes has an attribute
         if(aExpected.hasOwnProperty(i) && aActual.hasOwnProperty(i)) {
            // but values is differ
            if(aExpected[i].nodeName == aActual[i].nodeName) {
              if(attributeExclude.indexOf(aExpected[i].nodeName) == -1) {
                var vExpected = aExpected[i].nodeValue;
                var vActual = aActual[i].nodeValue;
                if(this._options.stripSpaces && aExpected[i].nodeType != type.CDATA_SECTION_NODE) {
                  vExpected = vExpected.trim();
                  vActual = vActual.trim();
                }
                if(vExpected !== vActual) {
                  if(!this._collector.collectFailure(aExpected[i], aActual[i]))
                    flag = false;
                }
              }
            }
            // remove to check for extra/missed attributes;
            delete aActual[i];
            delete aExpected[i];
         }
      }

      // report all missed attributes
      for(i in aExpected) {
         if(aExpected.hasOwnProperty(i))
            if(!this._collector.collectFailure(aExpected[i], null))
               flag = false;
      }

      // report all extra attributes
      for(i in aActual) {
         if(aActual.hasOwnProperty(i))
            if(!this._collector.collectFailure(null, aActual[i]))
               flag = false;
      }

      return flag;
   };

   Comparator.prototype.compareNode = function(left, right) {
      var vLeft, vRight, r;

      if (left.nodeName === right.nodeName && left.nodeType == right.nodeType) {
         switch (left.nodeType) {
            case type.DOCUMENT_NODE:
               return this.compareNode(left.documentElement, right.documentElement);
            case type.ELEMENT_NODE:
               if(ignoreChildNodeDetail.indexOf(left.nodeName.toLowerCase()) > -1)
                 return this._compareAttributes(left.attributes, right.attributes);
               else
                 return this._compareAttributes(left.attributes, right.attributes) &&
                        this._compareNodeList(left.childNodes, right.childNodes);
            case type.TEXT_NODE:
               return true;
            case type.CDATA_SECTION_NODE:
               return true;
            case type.COMMENT_NODE:
               if (left.nodeType == type.COMMENT_NODE && !this._options.compareComments)
                  return true;
               vLeft = "" + left.nodeValue;
               vRight = "" + right.nodeValue;
               if (this._options.stripSpaces && left.nodeType !== type.CDATA_SECTION_NODE) {
                  vLeft = vLeft.trim();
                  vRight = vRight.trim();
               }
               r = vLeft === vRight;
               return !r ? this._collector.collectFailure(left, right) : r;
            default:
               throw Error("Node type " + left.nodeType + " comparison is not implemented");
         }
      } else
         return this._collector.collectFailure(left, right);
   };

   module.exports = function(a, b, options, attribute, ignore) {


      var collector = new Collector(options);
      var comparator = new Comparator(options, collector, attribute, ignore);
      comparator.compareNode(a, b);

      return collector;

   };

})();
