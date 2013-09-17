'use strict';

angular.module('WikipediaSearchApp')
    .controller('SuggestionsCtrl', function ($scope, ejsResource) {
        var ejs = ejsResource('http://localhost:19200');

        var oFilters =
            [
                ejs.MissingFilter('redirect'),
                ejs.MissingFilter('special'),
                ejs.MissingFilter('stub'),
                ejs.MissingFilter('disambiguation')
            ];

        $scope.selected = undefined;
        $scope.suggestions = [];

        $scope.onedit = function(){
            $scope.suggestions = [];

            if ($scope.selected.length < 2) return;

            $scope.suggestions = ejs.Request().indices('wiki-enwiki').types('wikipage')
                .query(ejs.FilteredQuery(ejs.MatchQuery('title', $scope.selected).type('phrase_prefix'), ejs.AndFilter(oFilters)))
                .fields(['title'])
                .doSearch(function(rsp) {
                    $scope.totalResults = rsp.hits.total;
                });
        }

    })
;
