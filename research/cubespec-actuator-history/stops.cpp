#include <algorithm>
#include <vector>

// Input and output are contiguous [sample, series] doubles. Each column is
// one actuator in one realization. Its memory starts at zero before padding.
extern "C" void stops(int samples, int series, const double* input,
                      const double* radius, double* output) {
    std::vector<double> memory(series, 0.0);
    for (int t = 0; t < samples; ++t) {
        for (int j = 0; j < series; ++j) {
            const int index = t * series + j;
            const double voltage = input[index];
            memory[j] = std::clamp(memory[j], voltage - radius[j], voltage + radius[j]);
            output[index] = voltage - memory[j];
        }
    }
}
