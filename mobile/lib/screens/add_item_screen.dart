import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class AddItemScreen extends StatefulWidget {
  const AddItemScreen({super.key});

  @override
  State<AddItemScreen> createState() => _AddItemScreenState();
}

class _AddItemScreenState extends State<AddItemScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _originController = TextEditingController();
  final TextEditingController _destinationController = TextEditingController();
  final TextEditingController _providerController = TextEditingController();
  
  String _selectedType = 'FLIGHT';
  final List<String> _types = ['FLIGHT', 'TRAIN', 'CAB', 'HOTEL', 'ACTIVITY'];
  
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));
  bool _isCreating = false;

  @override
  void dispose() {
    _originController.dispose();
    _destinationController.dispose();
    _providerController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked;
      });
    }
  }

  Future<void> _submit() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isCreating = true);
      
      final origin = _originController.text.trim();
      final destination = _destinationController.text.trim();
      final providerStr = _providerController.text.trim();
      
      final endTime = _startDate.add(const Duration(hours: 2));

      final payload = {
        "type": _selectedType,
        "provider": providerStr.isEmpty ? "Travora Services" : providerStr,
        "origin": origin,
        "destination": destination,
        "start_time": _startDate.toIso8601String(),
        "end_time": endTime.toIso8601String(),
        "cost": 0.0,
        "currency": "INR",
        "priority": "MEDIUM",
        "flexibility": "FLEXIBLE",
        "status": "CONFIRMED",
      };

      final provider = context.read<TripProvider>();
      final success = await provider.addItemToActiveTrip(payload);

      if (success && mounted) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Item successfully added to your journey')),
        );
      } else if (mounted) {
        setState(() => _isCreating = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(provider.errorMessage ?? 'Failed to add item')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add to Journey'),
      ),
      body: _isCreating
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text('Add a sub-trip, side-quest, or new transport to your current journey.', style: TextStyle(color: AppColors.textSecondary)),
                  const SizedBox(height: 24),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedType,
                    decoration: const InputDecoration(
                      labelText: 'Type of Transport / Stay',
                      border: OutlineInputBorder(),
                    ),
                    items: _types.map((String value) {
                      return DropdownMenuItem<String>(
                        value: value,
                        child: Text(value),
                      );
                    }).toList(),
                    onChanged: (newValue) {
                      setState(() {
                        _selectedType = newValue!;
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _originController,
                    decoration: const InputDecoration(
                      labelText: 'Origin / Location',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.location_on),
                    ),
                    validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 16),
                  if (_selectedType != 'HOTEL' && _selectedType != 'ACTIVITY')
                    TextFormField(
                      controller: _destinationController,
                      decoration: const InputDecoration(
                        labelText: 'Destination',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.location_on),
                      ),
                      validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                    ),
                  if (_selectedType != 'HOTEL' && _selectedType != 'ACTIVITY')
                    const SizedBox(height: 16),
                  TextFormField(
                    controller: _providerController,
                    decoration: const InputDecoration(
                      labelText: 'Operator / Airline (Optional)',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.business),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ListTile(
                    title: const Text('Date'),
                    subtitle: Text('${_startDate.day}/${_startDate.month}/${_startDate.year}'),
                    trailing: const Icon(Icons.calendar_today),
                    shape: RoundedRectangleBorder(
                      side: BorderSide(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    onPressed: _submit,
                    child: const Text('Add to Journey', style: TextStyle(fontSize: 16)),
                  ),
                ],
              ),
            ),
    );
  }
}
