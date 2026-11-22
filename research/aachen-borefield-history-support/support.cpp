// Convert a monthly source CSV into five-minute categories without decoding any temperature.
#include <algorithm>
#include <array>
#include <charconv>
#include <cmath>
#include <cstdio>
#include <iostream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

using Row = std::vector<std::string_view>;
using Columns = std::array<std::array<size_t, 3>, 40>;
using Flags = std::array<unsigned, 40>;
enum Flag : unsigned {
    UnknownFlow = 1, NegativeFlow = 2, ZeroFlow = 4, LowFlow = 8,
    ActiveFlow = 16, MissingInlet = 32, MissingOutlet = 64
};

Row fields(const std::string& line) {
    Row row;
    size_t start = 0;
    while (true) {
        const auto end = line.find(',', start);
        const auto stop = end == std::string::npos ? line.size() : end;
        row.emplace_back(line.data() + start, stop - start);
        if (end == std::string::npos) return row;
        start = end + 1;
    }
}

bool missing(std::string_view value) {
    return value.empty() || value == "nan" || value == "NaN" || value == "NA" ||
           value == "null" || value == "-inf" || value == "inf";
}

unsigned flow_flag(std::string_view value) {
    if (missing(value)) return UnknownFlow;
    double flow = 0;
    auto parsed = std::from_chars(value.data(), value.data() + value.size(), flow);
    if (parsed.ec != std::errc() || parsed.ptr != value.data() + value.size() || !std::isfinite(flow))
        throw std::runtime_error("unrecognized flow field");
    if (flow < 0) return NegativeFlow;
    if (flow == 0) return ZeroFlow;
    if (flow < .5) return LowFlow;
    return ActiveFlow;
}

Columns locate(const Row& header) {
    Columns columns{};
    const std::array<const char*, 3> metrics{"T_in", "T_out", "V_dot"};
    for (size_t well = 0; well < columns.size(); well++) {
        for (size_t metric = 0; metric < metrics.size(); metric++) {
            char label[40];
            std::snprintf(label, sizeof label, "Probe_%02zu_%s", well+1, metrics[metric]);
            auto position = std::find(header.begin(), header.end(), std::string_view(label));
            if (position == header.end()) throw std::runtime_error("missing source column");
            columns[well][metric] = position - header.begin();
        }
    }
    return columns;
}

void flush(const std::string& stamp, int count, const Flags& flags) {
    if (!count) return;
    std::cout << stamp << ',' << count << ',';
    for (unsigned bits : flags) std::cout.put(static_cast<char>(33 + bits));
    std::cout.put('\n');
}

int main(int argc, char** argv) {
    std::ios::sync_with_stdio(false);
    if (argc != 2) throw std::runtime_error("specify raw or prepared");
    const bool raw = std::string_view(argv[1]) == "raw";
    std::string line;
    if (!std::getline(std::cin, line)) throw std::runtime_error("missing header");
    if (!line.empty() && line.back() == '\r') line.pop_back();
    const Row header = fields(line);
    const auto columns = locate(header);
    const auto width = header.size();
    Flags flags{};
    std::string bin, previous;
    int count = 0;
    while (std::getline(std::cin, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        const Row row = fields(line);
        if (row.size() != width || row[0].size() < 19) throw std::runtime_error("invalid row");
        const std::string stamp(row[0].substr(0, 19));
        if (!previous.empty() && stamp <= previous) throw std::runtime_error("non-monotone timestamp");
        previous = stamp;
        const int minute = std::stoi(stamp.substr(14, 2));
        const int second = std::stoi(stamp.substr(17, 2));
        if (raw ? second % 30 != 0 : (minute % 5 != 0 || second != 0))
            throw std::runtime_error("unexpected timestamp grid");
        std::string next = stamp.substr(0, 15);
        next.push_back(minute % 10 >= 5 ? '5' : '0');
        if (next != bin) {
            flush(bin, count, flags);
            bin = next;
            count = 0;
            flags.fill(0);
        }
        count++;
        for (size_t well = 0; well < columns.size(); well++) {
            const auto& col = columns[well];
            flags[well] |= flow_flag(row[col[2]]);
            if (missing(row[col[0]])) flags[well] |= MissingInlet;
            if (missing(row[col[1]])) flags[well] |= MissingOutlet;
        }
    }
    flush(bin, count, flags);
}
